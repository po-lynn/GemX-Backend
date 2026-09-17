import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// This file validates that marking a case's read cursor is allowed for every access scope,
// including the read-only "moderation" scope — unlike sending a message, this only ever
// touches the caller's OWN read cursor, so it's not a thread-write action and needs no
// extra restriction. It also validates markEscrowCaseRead is always called with the
// session's own user id, never a client-supplied one.

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/staff-roles/db/staff-roles", () => ({ getStaffRole: vi.fn() }));
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }));
vi.mock("@/features/escrow-cases/db/escrow-cases", () => ({ getEscrowCaseById: vi.fn() }));
vi.mock("@/features/escrow-cases/db/case-messages", () => ({ markEscrowCaseRead: vi.fn() }));
vi.mock("@/lib/supabase/case-broadcast", () => ({
  broadcastCaseEvents: vi.fn().mockResolvedValue(undefined),
}));

const { auth } = await import("@/lib/auth");
const { getStaffRole } = await import("@/features/staff-roles/db/staff-roles");
const { checkInternalAccess } = await import("@/features/rbac/db/permissions");
const { getEscrowCaseById } = await import("@/features/escrow-cases/db/escrow-cases");
const { markEscrowCaseRead } = await import("@/features/escrow-cases/db/case-messages");
const { PATCH } = await import("@/app/api/admin/escrow-cases/[id]/read/route");

function makeRequest(): NextRequest {
  return new Request("http://localhost/api/admin/escrow-cases/case-1/read", {
    method: "PATCH",
  }) as unknown as NextRequest;
}

function makeContext(id = "case-1") {
  return { params: Promise.resolve({ id }) };
}

const caseRow = {
  id: "case-1",
  buyerId: "buyer-1",
  sellerId: "seller-1",
  listingId: "listing-1",
  assignedAgentId: "agent-1",
  state: "agent_assigned" as const,
};

describe("PATCH /api/admin/escrow-cases/[id]/read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEscrowCaseById).mockResolvedValue(caseRow);
    vi.mocked(markEscrowCaseRead).mockResolvedValue(undefined);
  });

  // Validates the endpoint is unauthenticated-safe: no session -> 401, no cursor write.
  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await PATCH(makeRequest(), makeContext());
    expect(res.status).toBe(401);
    expect(markEscrowCaseRead).not.toHaveBeenCalled();
  });

  // Validates the admin scope can mark its own cursor read.
  it("succeeds for scope admin", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);

    const res = await PATCH(makeRequest(), makeContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(markEscrowCaseRead).toHaveBeenCalledWith("case-1", "admin-1");
  });

  // Validates the supervisor scope can mark its own cursor read.
  it("succeeds for scope supervisor", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "super-1", role: "internal" },
    } as never);
    vi.mocked(getStaffRole).mockResolvedValue({
      userId: "super-1",
      role: "escrow_agent",
      isSupervisor: true,
    });

    const res = await PATCH(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    expect(markEscrowCaseRead).toHaveBeenCalledWith("case-1", "super-1");
  });

  // Validates the plain assigned-agent scope ("own") can mark its own cursor read.
  it("succeeds for scope own (assigned escrow_agent)", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "agent-1", role: "internal" },
    } as never); // caseRow.assignedAgentId === "agent-1"
    vi.mocked(getStaffRole).mockResolvedValue({
      userId: "agent-1",
      role: "escrow_agent",
      isSupervisor: false,
    });
    vi.mocked(checkInternalAccess).mockResolvedValue(true);

    const res = await PATCH(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    expect(markEscrowCaseRead).toHaveBeenCalledWith("case-1", "agent-1");
  });

  // Validates the read-only "moderation" scope — the same scope POST /messages rejects —
  // IS allowed here, because marking your own read cursor isn't thread participation.
  it("succeeds for scope moderation", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "mod-1", role: "internal" },
    } as never);
    vi.mocked(getStaffRole).mockResolvedValue({
      userId: "mod-1",
      role: "moderator",
      isSupervisor: false,
    });
    vi.mocked(checkInternalAccess).mockResolvedValue(true);

    const res = await PATCH(makeRequest(), makeContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(markEscrowCaseRead).toHaveBeenCalledWith("case-1", "mod-1");
  });
});

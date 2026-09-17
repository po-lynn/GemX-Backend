import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// This file validates requireEscrowCaseAccess's row-level guard as exercised through the
// GET detail route: admin/supervisor full access, a plain escrow_agent restricted to their
// own assigned case (and only with the ESCROW_CASES feature key), and a moderator (with the
// CHAT_MODERATION feature key) granted the read-only "moderation" scope for GET.

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/staff-roles/db/staff-roles", () => ({ getStaffRole: vi.fn() }));
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }));
vi.mock("@/features/escrow-cases/db/escrow-cases", () => ({
  getEscrowCaseById: vi.fn(),
  getEscrowCaseDetail: vi.fn(),
}));

const { auth } = await import("@/lib/auth");
const { getStaffRole } = await import("@/features/staff-roles/db/staff-roles");
const { checkInternalAccess } = await import("@/features/rbac/db/permissions");
const { getEscrowCaseById, getEscrowCaseDetail } = await import(
  "@/features/escrow-cases/db/escrow-cases"
);
const { FEATURE_KEYS } = await import("@/features/rbac/feature-keys");
const { GET } = await import("@/app/api/admin/escrow-cases/[id]/route");

function makeRequest(): NextRequest {
  return new Request("http://localhost/api/admin/escrow-cases/case-1") as unknown as NextRequest;
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

const caseDetail = { ...caseRow, listingTitle: "A ruby", agreedPriceMinor: 100000 };

describe("GET /api/admin/escrow-cases/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Validates the case-not-found path returns 404 even before role/scope is evaluated.
  it("returns 404 when the case does not exist", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);
    vi.mocked(getEscrowCaseById).mockResolvedValue(null);

    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(404);
    expect(getEscrowCaseDetail).not.toHaveBeenCalled();
  });

  // Validates the endpoint is unauthenticated-safe: no session -> 401, no case lookup at all.
  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(401);
    expect(getEscrowCaseById).not.toHaveBeenCalled();
  });

  // Validates that role "internal" with no staff_role row at all (not a recognized escrow_agent
  // or moderator designation, and not admin) is rejected.
  it("returns 403 for role internal with no staff_role row", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "staff-1", role: "internal" },
    } as never);
    vi.mocked(getEscrowCaseById).mockResolvedValue(caseRow);
    vi.mocked(getStaffRole).mockResolvedValue(null);

    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(403);
    expect(getEscrowCaseDetail).not.toHaveBeenCalled();
  });

  // Validates a plain (non-supervisor) escrow_agent cannot open a case assigned to someone
  // else — the row-level "own case only" restriction.
  it("returns 403 for a plain escrow_agent whose id does not match the case's assignedAgentId", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "other-agent", role: "internal" },
    } as never);
    vi.mocked(getEscrowCaseById).mockResolvedValue(caseRow); // assignedAgentId: "agent-1"
    vi.mocked(getStaffRole).mockResolvedValue({
      userId: "other-agent",
      role: "escrow_agent",
      isSupervisor: false,
    });

    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(403);
    // Short-circuits on the id mismatch — the feature-key check never even runs.
    expect(checkInternalAccess).not.toHaveBeenCalled();
    expect(getEscrowCaseDetail).not.toHaveBeenCalled();
  });

  // Validates the happy path for the assigned agent: matching id AND the ESCROW_CASES
  // feature key together grant access to their own case.
  it("returns 200 for the assigned agent holding the ESCROW_CASES feature key", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "agent-1", role: "internal" },
    } as never);
    vi.mocked(getEscrowCaseById).mockResolvedValue(caseRow); // assignedAgentId: "agent-1"
    vi.mocked(getStaffRole).mockResolvedValue({
      userId: "agent-1",
      role: "escrow_agent",
      isSupervisor: false,
    });
    vi.mocked(checkInternalAccess).mockResolvedValue(true);
    vi.mocked(getEscrowCaseDetail).mockResolvedValue(caseDetail as never);

    const res = await GET(makeRequest(), makeContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.case).toEqual(caseDetail);
    expect(checkInternalAccess).toHaveBeenCalledWith("agent-1", FEATURE_KEYS.ESCROW_CASES);
  });

  // Validates the moderator "read scope": GET detail is allowed for oversight, distinct
  // from the escrow_agent path and gated on the CHAT_MODERATION feature key.
  it("returns 200 for a moderator holding the CHAT_MODERATION feature key", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "mod-1", role: "internal" },
    } as never);
    vi.mocked(getEscrowCaseById).mockResolvedValue(caseRow);
    vi.mocked(getStaffRole).mockResolvedValue({
      userId: "mod-1",
      role: "moderator",
      isSupervisor: false,
    });
    vi.mocked(checkInternalAccess).mockResolvedValue(true);
    vi.mocked(getEscrowCaseDetail).mockResolvedValue(caseDetail as never);

    const res = await GET(makeRequest(), makeContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(checkInternalAccess).toHaveBeenCalledWith("mod-1", FEATURE_KEYS.CHAT_MODERATION);
  });
});

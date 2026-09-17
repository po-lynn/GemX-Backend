import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Validates POST /api/admin/escrow-cases/[id]/assign: only a supervisor or admin may
// assign/reassign — even the case's own currently-assigned agent (an "own" scope
// session) is rejected, since handing a case to someone else is a supervisor decision,
// not something the agent working it can do themselves.

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/staff-roles/db/staff-roles", () => ({ getStaffRole: vi.fn() }));
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }));
vi.mock("@/features/escrow-cases/db/escrow-cases", () => ({ getEscrowCaseById: vi.fn() }));
vi.mock("@/features/escrow-cases/db/case-transitions", async () => {
  const actual = await vi.importActual<typeof import("@/features/escrow-cases/db/case-transitions")>(
    "@/features/escrow-cases/db/case-transitions"
  );
  return { ...actual, setEscrowCaseAgent: vi.fn() };
});
vi.mock("@/lib/supabase/case-broadcast", () => ({ broadcastCaseEvents: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/drizzle/db", () => ({ db: { select: vi.fn() } }));

const { auth } = await import("@/lib/auth");
const { getStaffRole } = await import("@/features/staff-roles/db/staff-roles");
const { checkInternalAccess } = await import("@/features/rbac/db/permissions");
const { getEscrowCaseById } = await import("@/features/escrow-cases/db/escrow-cases");
const { setEscrowCaseAgent, EscrowCaseInvalidRequestError } = await import(
  "@/features/escrow-cases/db/case-transitions"
);
const { db } = await import("@/drizzle/db");
const { POST } = await import("@/app/api/admin/escrow-cases/[id]/assign/route");

function selectChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function makeContext(id = "case-1") {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/admin/escrow-cases/case-1/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const caseRow = {
  id: "case-1",
  buyerId: "buyer-1",
  sellerId: "seller-1",
  listingId: "listing-1",
  assignedAgentId: "agent-1",
  state: "verification" as const,
};

function mockOwnAgentSession() {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "agent-1", role: "internal" } } as never);
  vi.mocked(getEscrowCaseById).mockResolvedValue(caseRow);
  vi.mocked(getStaffRole).mockResolvedValue({ userId: "agent-1", role: "escrow_agent", isSupervisor: false });
  vi.mocked(checkInternalAccess).mockResolvedValue(true);
}

function mockSupervisorSession() {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "sup-1", role: "internal" } } as never);
  vi.mocked(getEscrowCaseById).mockResolvedValue(caseRow);
  vi.mocked(getStaffRole).mockResolvedValue({ userId: "sup-1", role: "escrow_agent", isSupervisor: true });
  vi.mocked(checkInternalAccess).mockResolvedValue(true);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/escrow-cases/[id]/assign", () => {
  it("returns 403 for the case's own assigned agent (own scope can't reassign)", async () => {
    mockOwnAgentSession();

    const res = await POST(makeRequest({ agentId: "agent-2" }), makeContext());

    expect(res.status).toBe(403);
    expect(setEscrowCaseAgent).not.toHaveBeenCalled();
  });

  it("returns 200 for a supervisor and resolves both the new and previous agent's names", async () => {
    mockSupervisorSession();
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([{ name: "New Agent" }]) as never)
      .mockReturnValueOnce(selectChain([{ name: "Old Agent" }]) as never);
    vi.mocked(setEscrowCaseAgent).mockResolvedValue({ ...caseRow, assignedAgentId: "agent-2" });

    const res = await POST(makeRequest({ agentId: "agent-2" }), makeContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(setEscrowCaseAgent).toHaveBeenCalledWith({
      caseId: "case-1",
      agentId: "agent-2",
      agentName: "New Agent",
      actorId: "sup-1",
      previousAgentName: "Old Agent",
    });
  });

  it("returns 404 when the target agent id doesn't resolve to a real user", async () => {
    mockSupervisorSession();
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never);

    const res = await POST(makeRequest({ agentId: "ghost" }), makeContext());

    expect(res.status).toBe(404);
    expect(setEscrowCaseAgent).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty agentId", async () => {
    mockSupervisorSession();

    const res = await POST(makeRequest({ agentId: "" }), makeContext());

    expect(res.status).toBe(400);
    expect(setEscrowCaseAgent).not.toHaveBeenCalled();
  });

  it("maps EscrowCaseInvalidRequestError (already assigned to this agent) to 400", async () => {
    mockSupervisorSession();
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([{ name: "Agent One" }]) as never)
      .mockReturnValueOnce(selectChain([{ name: "Agent One" }]) as never);
    vi.mocked(setEscrowCaseAgent).mockRejectedValue(
      new EscrowCaseInvalidRequestError("Case is already assigned to this agent")
    );

    const res = await POST(makeRequest({ agentId: "agent-1" }), makeContext());

    expect(res.status).toBe(400);
  });
});

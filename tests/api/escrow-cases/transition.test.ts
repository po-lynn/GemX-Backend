import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Validates POST /api/admin/escrow-cases/[id]/transition: the assigned agent, a
// supervisor, and an admin may drive the case's state; a moderator (read-only
// "moderation" scope) is rejected, same as message sending — moderators get oversight,
// never participation. Also validates that state-machine/conflict errors map to 409 and
// case-not-found maps to 404.

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/staff-roles/db/staff-roles", () => ({ getStaffRole: vi.fn() }));
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }));
vi.mock("@/features/escrow-cases/db/escrow-cases", () => ({ getEscrowCaseById: vi.fn() }));
vi.mock("@/features/escrow-cases/db/case-transitions", async () => {
  const actual = await vi.importActual<typeof import("@/features/escrow-cases/db/case-transitions")>(
    "@/features/escrow-cases/db/case-transitions"
  );
  return { ...actual, transitionEscrowCaseState: vi.fn() };
});
vi.mock("@/lib/supabase/case-broadcast", () => ({ broadcastCaseEvents: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/features/notifications/services/escrow-case-notifications", () => ({
  sendEscrowCaseStateChangeNotification: vi.fn().mockResolvedValue(undefined),
}));

const { auth } = await import("@/lib/auth");
const { getStaffRole } = await import("@/features/staff-roles/db/staff-roles");
const { checkInternalAccess } = await import("@/features/rbac/db/permissions");
const { getEscrowCaseById } = await import("@/features/escrow-cases/db/escrow-cases");
const {
  transitionEscrowCaseState,
  EscrowCaseConflictError,
  EscrowCaseInvalidRequestError,
  EscrowCaseNotFoundError,
} = await import("@/features/escrow-cases/db/case-transitions");
const { EscrowCaseStateError } = await import("@/features/escrow-cases/lib/state-machine");
const { POST } = await import("@/app/api/admin/escrow-cases/[id]/transition/route");

function makeContext(id = "case-1") {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/admin/escrow-cases/case-1/transition", {
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

function mockAssignedAgentSession() {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "agent-1", role: "internal" } } as never);
  vi.mocked(getEscrowCaseById).mockResolvedValue(caseRow);
  vi.mocked(getStaffRole).mockResolvedValue({ userId: "agent-1", role: "escrow_agent", isSupervisor: false });
  vi.mocked(checkInternalAccess).mockResolvedValue(true);
}

function mockModeratorSession() {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "mod-1", role: "internal" } } as never);
  vi.mocked(getEscrowCaseById).mockResolvedValue(caseRow);
  vi.mocked(getStaffRole).mockResolvedValue({ userId: "mod-1", role: "moderator", isSupervisor: false });
  vi.mocked(checkInternalAccess).mockResolvedValue(true);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/escrow-cases/[id]/transition", () => {
  it("returns 403 for a moderator (read-only scope can't drive the case)", async () => {
    mockModeratorSession();

    const res = await POST(makeRequest({ toState: "payment_pending" }), makeContext());

    expect(res.status).toBe(403);
    expect(transitionEscrowCaseState).not.toHaveBeenCalled();
  });

  it("returns 200 for the assigned agent and passes actorId from the session, never the body", async () => {
    mockAssignedAgentSession();
    vi.mocked(transitionEscrowCaseState).mockResolvedValue({ ...caseRow, state: "payment_pending" });

    const res = await POST(
      makeRequest({ toState: "payment_pending", actorId: "someone-else" }),
      makeContext()
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(transitionEscrowCaseState).toHaveBeenCalledWith({
      caseId: "case-1",
      toState: "payment_pending",
      actorId: "agent-1",
      reason: undefined,
    });
  });

  it("returns 400 for an invalid toState value not in the enum", async () => {
    mockAssignedAgentSession();

    const res = await POST(makeRequest({ toState: "not_a_real_state" }), makeContext());

    expect(res.status).toBe(400);
    expect(transitionEscrowCaseState).not.toHaveBeenCalled();
  });

  it("maps EscrowCaseStateError (invalid transition) to 409", async () => {
    mockAssignedAgentSession();
    vi.mocked(transitionEscrowCaseState).mockRejectedValue(new EscrowCaseStateError("verification", "completed"));

    const res = await POST(makeRequest({ toState: "completed" }), makeContext());

    expect(res.status).toBe(409);
  });

  it("maps EscrowCaseConflictError to 409", async () => {
    mockAssignedAgentSession();
    vi.mocked(transitionEscrowCaseState).mockRejectedValue(new EscrowCaseConflictError("case-1"));

    const res = await POST(makeRequest({ toState: "payment_pending" }), makeContext());

    expect(res.status).toBe(409);
  });

  it("maps EscrowCaseNotFoundError to 404", async () => {
    mockAssignedAgentSession();
    vi.mocked(transitionEscrowCaseState).mockRejectedValue(new EscrowCaseNotFoundError("case-1"));

    const res = await POST(makeRequest({ toState: "payment_pending" }), makeContext());

    expect(res.status).toBe(404);
  });

  // "agent_assigned" can only be reached via /assign — the db layer rejects it with
  // EscrowCaseInvalidRequestError, and this route must map that to 400, not 500 (it's
  // a malformed request, not a server fault).
  it("maps EscrowCaseInvalidRequestError to 400", async () => {
    mockAssignedAgentSession();
    vi.mocked(transitionEscrowCaseState).mockRejectedValue(
      new EscrowCaseInvalidRequestError('Use assignEscrowCaseAgent to transition into "agent_assigned"')
    );

    const res = await POST(makeRequest({ toState: "agent_assigned" }), makeContext());

    expect(res.status).toBe(400);
  });
});

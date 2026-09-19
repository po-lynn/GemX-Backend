import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Mirrors tests/api/chat/messages-rate-limit.test.ts: validates the case-thread send
// path enforces its own 30-messages/60s sliding window (counted against
// escrow_case_message, not the flat `messages` table) before any restriction check
// would otherwise let the send through.

vi.mock("next/server", () => ({ connection: vi.fn(), after: vi.fn((fn: () => unknown) => fn()) }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/staff-roles/db/staff-roles", () => ({ getStaffRole: vi.fn() }));
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }));
vi.mock("@/features/escrow-cases/db/escrow-cases", () => ({ getEscrowCaseById: vi.fn() }));
vi.mock("@/features/escrow-cases/db/case-messages", () => ({
  listEscrowCaseMessages: vi.fn(),
  sendEscrowCaseMessage: vi.fn(),
}));
vi.mock("@/features/escrow-cases/db/case-attachments", () => ({
  createEscrowCaseAttachment: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/case-broadcast", () => ({
  broadcastCaseEvents: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/notifications/services/escrow-case-notifications", () => ({
  sendEscrowCaseMessageNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/chat-moderation/db/restrictions", () => ({
  getActiveRestriction: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/features/chat-moderation/db/audit-log", () => ({
  recordThreadViewed: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/drizzle/db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));

const { auth } = await import("@/lib/auth");
const { getStaffRole } = await import("@/features/staff-roles/db/staff-roles");
const { checkInternalAccess } = await import("@/features/rbac/db/permissions");
const { getEscrowCaseById } = await import("@/features/escrow-cases/db/escrow-cases");
const { sendEscrowCaseMessage } = await import("@/features/escrow-cases/db/case-messages");
const { db } = await import("@/drizzle/db");
const { POST } = await import("@/app/api/admin/escrow-cases/[id]/messages/route");

function selectChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function pendingChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.then = () => {
    /* never settles */
  };
  return chain;
}

function makeContext(id = "case-1") {
  return { params: Promise.resolve({ id }) };
}

function makePostRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/admin/escrow-cases/case-1/messages", {
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
  state: "agent_assigned" as const,
};

function mockAssignedAgentSession() {
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "agent-1", role: "internal" },
  } as never);
  vi.mocked(getEscrowCaseById).mockResolvedValue(caseRow);
  vi.mocked(getStaffRole).mockResolvedValue({
    userId: "agent-1",
    role: "escrow_agent",
    isSupervisor: false,
  });
  vi.mocked(checkInternalAccess).mockResolvedValue(true);
}

describe("POST /api/admin/escrow-cases/[id]/messages send rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssignedAgentSession();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 30+ case messages sent by this agent in the last 60s → 429, no send attempted.
  it("returns 429 and skips the send when the sender exceeds the window", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([{ count: 30 }]) as never);

    const res = await POST(makePostRequest({ content: "one more" }), makeContext());

    expect(res.status).toBe(429);
    expect(sendEscrowCaseMessage).not.toHaveBeenCalled();
  });

  // A hung rate-limit count query must fail closed (503), never fall back to "0 sent
  // so far" — same fail-closed contract as the flat chat send path.
  it("returns 503 with Retry-After when the rate-limit count hangs past the timeout", async () => {
    vi.useFakeTimers();
    vi.mocked(db.select).mockReturnValueOnce(pendingChain() as never);

    const resPromise = POST(makePostRequest({ content: "hello" }), makeContext());
    await vi.advanceTimersByTimeAsync(6000);
    const res = await resPromise;

    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("3");
    expect(sendEscrowCaseMessage).not.toHaveBeenCalled();
  });
});

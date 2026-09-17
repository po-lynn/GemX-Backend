import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// This file validates the case-thread GET/POST split: any access scope (including the
// read-only "moderation" scope) may GET the thread, but requireEscrowThreadWriteAccess
// explicitly rejects the "moderation" scope on POST. That POST rejection is the single
// most important test in this suite — it's what makes "moderator gets oversight, not
// escrow participation" structurally true rather than a comment. It also validates that
// the sender id on a sent message always comes from the session, never the request body.

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/staff-roles/db/staff-roles", () => ({ getStaffRole: vi.fn() }));
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }));
vi.mock("@/features/escrow-cases/db/escrow-cases", () => ({ getEscrowCaseById: vi.fn() }));
vi.mock("@/features/escrow-cases/db/case-messages", () => ({
  listEscrowCaseMessages: vi.fn(),
  sendEscrowCaseMessage: vi.fn(),
}));
vi.mock("@/drizzle/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/lib/supabase/case-broadcast", () => ({
  broadcastCaseEvents: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/notifications/services/escrow-case-notifications", () => ({
  sendEscrowCaseMessageNotification: vi.fn().mockResolvedValue(undefined),
}));

const { auth } = await import("@/lib/auth");
const { getStaffRole } = await import("@/features/staff-roles/db/staff-roles");
const { checkInternalAccess } = await import("@/features/rbac/db/permissions");
const { getEscrowCaseById } = await import("@/features/escrow-cases/db/escrow-cases");
const { listEscrowCaseMessages, sendEscrowCaseMessage } = await import(
  "@/features/escrow-cases/db/case-messages"
);
const { db } = await import("@/drizzle/db");
const { GET, POST } = await import("@/app/api/admin/escrow-cases/[id]/messages/route");

/** Thenable select-chain mock, matching this repo's existing convention for raw Drizzle
 *  chains (see tests/api/chat/history.test.ts) — used here for the sender-name lookup. */
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

function makeGetRequest(): NextRequest {
  return new Request("http://localhost/api/admin/escrow-cases/case-1/messages") as unknown as NextRequest;
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

const savedMessage = {
  id: "msg-1",
  caseId: "case-1",
  senderId: "agent-1",
  kind: "message",
  visibility: "case",
  content: "hello there",
  fileUrl: null,
  imageUrls: null,
  attachmentType: "text",
  systemEventType: null,
  systemEventPayload: null,
  createdAt: "2026-07-05T00:00:00.000Z",
};

function mockModeratorSession() {
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
}

function mockAssignedAgentSession() {
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
}

describe("GET /api/admin/escrow-cases/[id]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Validates that the read-only "moderation" scope IS allowed to read the thread —
  // oversight requires visibility, just not participation.
  it("returns 200 for a moderator (read-only scope may read)", async () => {
    mockModeratorSession();
    vi.mocked(listEscrowCaseMessages).mockResolvedValue([savedMessage as never]);

    const res = await GET(makeGetRequest(), makeContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.messages).toHaveLength(1);
  });
});

describe("POST /api/admin/escrow-cases/[id]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // THE key test of this suite: a moderator (read-only "moderation" scope) must be
  // structurally blocked from posting into the case thread, even though they can GET it.
  it("returns 403 for a moderator, even though they can GET the same thread", async () => {
    mockModeratorSession();

    const res = await POST(makePostRequest({ content: "I would like to weigh in" }), makeContext());

    expect(res.status).toBe(403);
    expect(sendEscrowCaseMessage).not.toHaveBeenCalled();
  });

  // Validates the happy path for the assigned agent: the message is sent with senderId
  // taken from the session (never the request body) and content trimmed by the schema.
  it("returns 200 for the assigned agent and sends with the session user id as senderId", async () => {
    mockAssignedAgentSession();
    vi.mocked(sendEscrowCaseMessage).mockResolvedValue(savedMessage as never);
    vi.mocked(db.select).mockReturnValue(selectChain([{ name: "Agent One" }]) as never);

    const res = await POST(
      makePostRequest({ senderId: "someone-else", content: "  hello there  " }),
      makeContext()
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toEqual(savedMessage);
    expect(sendEscrowCaseMessage).toHaveBeenCalledWith({
      caseId: "case-1",
      senderId: "agent-1",
      content: "hello there",
    });
  });

  // Validates the content schema rejects empty/whitespace-only bodies (trim().min(1)),
  // for a caller who otherwise has valid write access.
  it("returns 400 for whitespace-only content", async () => {
    mockAssignedAgentSession();

    const res = await POST(makePostRequest({ content: "   " }), makeContext());

    expect(res.status).toBe(400);
    expect(sendEscrowCaseMessage).not.toHaveBeenCalled();
  });
});

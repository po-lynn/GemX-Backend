import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Validates the mobile/web "report this message" endpoint: only a participant of the
// flat message (sender or recipient) may file a report, a duplicate open report from
// the same reporter is returned instead of re-inserted, and the reported content is
// snapshotted server-side (never trusted from the request body) since a flat message
// can later be hard-deleted.

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/drizzle/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/features/chat-moderation/db/reports", () => ({
  createMessageReport: vi.fn(),
}));

const { auth } = await import("@/lib/auth");
const { db } = await import("@/drizzle/db");
const { createMessageReport } = await import("@/features/chat-moderation/db/reports");
const { POST } = await import("@/app/api/chat/messages/[messageId]/report/route");

function selectChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(result));
  return chain;
}

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/chat/messages/msg-1/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function makeContext(messageId = "msg-1") {
  return { params: Promise.resolve({ messageId }) };
}

const messageRow = {
  id: "msg-1",
  senderId: "sender-1",
  recipientId: "recipient-1",
  content: "unwanted content",
  imageUrls: null,
  messageType: "text",
};

describe("POST /api/chat/messages/[messageId]/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "recipient-1" } } as never);
  });

  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await POST(makeRequest({ reason: "spam" }), makeContext());
    expect(res.status).toBe(401);
  });

  it("returns 400 for a missing reason", async () => {
    const res = await POST(makeRequest({}), makeContext());
    expect(res.status).toBe(400);
  });

  it("returns 404 when the message doesn't exist", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never);
    const res = await POST(makeRequest({ reason: "spam" }), makeContext());
    expect(res.status).toBe(404);
  });

  // The reporting caller must be a participant — a third party (neither sender nor
  // recipient) gets the same 404 a nonexistent message would, so message ids can't be
  // probed for existence by non-participants.
  it("returns 404 when the caller is not a participant in the message", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "stranger-1" } } as never);
    vi.mocked(db.select).mockReturnValueOnce(selectChain([messageRow]) as never);

    const res = await POST(makeRequest({ reason: "spam" }), makeContext());

    expect(res.status).toBe(404);
    expect(createMessageReport).not.toHaveBeenCalled();
  });

  it("files a report with a server-side content snapshot for the recipient", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([messageRow]) as never) // message lookup
      .mockReturnValueOnce(selectChain([]) as never); // no existing open report
    vi.mocked(createMessageReport).mockResolvedValue({ id: "report-1" });

    const res = await POST(
      makeRequest({ reason: "spam", contentSnapshot: "attacker-supplied text" }),
      makeContext()
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.report).toEqual({ id: "report-1" });
    expect(createMessageReport).toHaveBeenCalledWith({
      flatMessageId: "msg-1",
      reporterId: "recipient-1",
      reason: "spam",
      contentSnapshot: "unwanted content",
    });
  });

  // The sender (not just the recipient) may also report their own sent message —
  // useful if it was sent in error or the thread turned abusive both ways.
  it("allows the sender to file a report too", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "sender-1" } } as never);
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([messageRow]) as never)
      .mockReturnValueOnce(selectChain([]) as never);
    vi.mocked(createMessageReport).mockResolvedValue({ id: "report-2" });

    const res = await POST(makeRequest({ reason: "sent by mistake" }), makeContext());

    expect(res.status).toBe(200);
    expect(createMessageReport).toHaveBeenCalledWith(
      expect.objectContaining({ reporterId: "sender-1" })
    );
  });

  it("returns the existing report instead of inserting a duplicate", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(selectChain([messageRow]) as never)
      .mockReturnValueOnce(selectChain([{ id: "existing-report" }]) as never);

    const res = await POST(makeRequest({ reason: "spam again" }), makeContext());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.alreadyReported).toBe(true);
    expect(json.report).toEqual({ id: "existing-report" });
    expect(createMessageReport).not.toHaveBeenCalled();
  });
});

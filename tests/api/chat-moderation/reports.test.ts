import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Validates GET/POST /api/admin/chat-moderation/reports and POST .../[id]/resolve:
// exactly one of flatMessageId/caseMessageId is required, reporterId always comes
// from the session, and resolve maps the two db error classes to 404/409.

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }));
vi.mock("@/features/chat-moderation/db/reports", () => ({
  createMessageReport: vi.fn(),
  listMessageReports: vi.fn(),
  resolveMessageReport: vi.fn(),
  MessageReportNotFoundError: class MessageReportNotFoundError extends Error {},
  MessageReportAlreadyResolvedError: class MessageReportAlreadyResolvedError extends Error {},
}));

const { auth } = await import("@/lib/auth");
const { checkInternalAccess } = await import("@/features/rbac/db/permissions");
const {
  createMessageReport,
  listMessageReports,
  resolveMessageReport,
  MessageReportNotFoundError,
  MessageReportAlreadyResolvedError,
} = await import("@/features/chat-moderation/db/reports");
const { GET, POST } = await import("@/app/api/admin/chat-moderation/reports/route");
const { POST: RESOLVE } = await import("@/app/api/admin/chat-moderation/reports/[id]/resolve/route");

function makeContext(id = "report-1") {
  return { params: Promise.resolve({ id }) };
}

function makeGetRequest(query = ""): NextRequest {
  return new Request(`http://localhost/api/admin/chat-moderation/reports${query}`) as unknown as NextRequest;
}

function makeJsonRequest(method: string, body: unknown, url = "http://localhost/api/admin/chat-moderation/reports"): NextRequest {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function mockAdminSession() {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never);
}

function mockInternalWithoutKey() {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1", role: "internal" } } as never);
  vi.mocked(checkInternalAccess).mockResolvedValue(false);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/chat-moderation/reports", () => {
  it("returns 403 for an internal user without the CHAT_MODERATION key", async () => {
    mockInternalWithoutKey();
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it("defaults to no status filter (open+dismissed+actioned)", async () => {
    mockAdminSession();
    vi.mocked(listMessageReports).mockResolvedValue([]);

    await GET(makeGetRequest());

    expect(listMessageReports).toHaveBeenCalledWith({ status: undefined });
  });

  it("ignores an invalid status value rather than passing it through", async () => {
    mockAdminSession();
    vi.mocked(listMessageReports).mockResolvedValue([]);

    await GET(makeGetRequest("?status=bogus"));

    expect(listMessageReports).toHaveBeenCalledWith({ status: undefined });
  });

  it("passes a valid status filter through", async () => {
    mockAdminSession();
    vi.mocked(listMessageReports).mockResolvedValue([]);

    await GET(makeGetRequest("?status=open"));

    expect(listMessageReports).toHaveBeenCalledWith({ status: "open" });
  });
});

describe("POST /api/admin/chat-moderation/reports", () => {
  it("returns 400 when both flatMessageId and caseMessageId are provided", async () => {
    mockAdminSession();

    const res = await POST(
      makeJsonRequest("POST", {
        flatMessageId: "m1",
        caseMessageId: "cm1",
        reason: "spam",
        contentSnapshot: "hi",
      })
    );

    expect(res.status).toBe(400);
    expect(createMessageReport).not.toHaveBeenCalled();
  });

  it("returns 400 when neither flatMessageId nor caseMessageId is provided", async () => {
    mockAdminSession();

    const res = await POST(makeJsonRequest("POST", { reason: "spam", contentSnapshot: "hi" }));

    expect(res.status).toBe(400);
    expect(createMessageReport).not.toHaveBeenCalled();
  });

  it("attributes reporterId to the session, never the request body", async () => {
    mockAdminSession();
    vi.mocked(createMessageReport).mockResolvedValue({ id: "report-1" });

    await POST(
      makeJsonRequest("POST", {
        flatMessageId: "m1",
        reason: "spam",
        contentSnapshot: "buy my thing",
        reporterId: "someone-else",
      })
    );

    expect(createMessageReport).toHaveBeenCalledWith({
      flatMessageId: "m1",
      caseMessageId: undefined,
      reporterId: "admin-1",
      reason: "spam",
      contentSnapshot: "buy my thing",
    });
  });
});

describe("POST /api/admin/chat-moderation/reports/[id]/resolve", () => {
  it("returns 400 when reason is missing", async () => {
    mockAdminSession();

    const res = await RESOLVE(makeJsonRequest("POST", { action: "dismiss" }), makeContext());

    expect(res.status).toBe(400);
    expect(resolveMessageReport).not.toHaveBeenCalled();
  });

  it("returns 404 when the report doesn't exist", async () => {
    mockAdminSession();
    vi.mocked(resolveMessageReport).mockRejectedValue(new MessageReportNotFoundError("not found"));

    const res = await RESOLVE(makeJsonRequest("POST", { action: "dismiss", reason: "n/a" }), makeContext());

    expect(res.status).toBe(404);
  });

  it("returns 409 when the report was already resolved", async () => {
    mockAdminSession();
    vi.mocked(resolveMessageReport).mockRejectedValue(new MessageReportAlreadyResolvedError("already resolved"));

    const res = await RESOLVE(makeJsonRequest("POST", { action: "dismiss", reason: "n/a" }), makeContext());

    expect(res.status).toBe(409);
  });

  it("resolves with the session admin attributed as resolvedByAdminId", async () => {
    mockAdminSession();
    vi.mocked(resolveMessageReport).mockResolvedValue(undefined);

    const res = await RESOLVE(
      makeJsonRequest("POST", { action: "ban_user", reason: "repeated spam" }),
      makeContext()
    );

    expect(res.status).toBe(200);
    expect(resolveMessageReport).toHaveBeenCalledWith({
      reportId: "report-1",
      action: "ban_user",
      reason: "repeated spam",
      resolvedByAdminId: "admin-1",
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Validates GET /api/admin/chat-moderation/audit-log's three mutually exclusive modes:
// by target, by actor, and the unfiltered recent feed.

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }));
vi.mock("@/features/chat-moderation/db/audit-log", () => ({
  listAuditLogForTarget: vi.fn(),
  listAuditLogForActor: vi.fn(),
  listRecentAuditLog: vi.fn(),
}));

const { auth } = await import("@/lib/auth");
const { checkInternalAccess } = await import("@/features/rbac/db/permissions");
const { listAuditLogForTarget, listAuditLogForActor, listRecentAuditLog } = await import(
  "@/features/chat-moderation/db/audit-log"
);
const { GET } = await import("@/app/api/admin/chat-moderation/audit-log/route");

function makeGetRequest(query = ""): NextRequest {
  return new Request(`http://localhost/api/admin/chat-moderation/audit-log${query}`) as unknown as NextRequest;
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

describe("GET /api/admin/chat-moderation/audit-log", () => {
  it("returns 403 for an internal user without the CHAT_MODERATION key", async () => {
    mockInternalWithoutKey();
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid targetType even when targetId is present", async () => {
    mockAdminSession();

    const res = await GET(makeGetRequest("?targetType=bogus&targetId=x"));

    expect(res.status).toBe(400);
    expect(listAuditLogForTarget).not.toHaveBeenCalled();
  });

  it("looks up by target when targetType and targetId are both given", async () => {
    mockAdminSession();
    vi.mocked(listAuditLogForTarget).mockResolvedValue([]);

    await GET(makeGetRequest("?targetType=escrow_case&targetId=case-1"));

    expect(listAuditLogForTarget).toHaveBeenCalledWith("escrow_case", "case-1");
    expect(listAuditLogForActor).not.toHaveBeenCalled();
    expect(listRecentAuditLog).not.toHaveBeenCalled();
  });

  it("looks up by actor when only actorId is given", async () => {
    mockAdminSession();
    vi.mocked(listAuditLogForActor).mockResolvedValue([]);

    await GET(makeGetRequest("?actorId=mod-1"));

    expect(listAuditLogForActor).toHaveBeenCalledWith("mod-1");
    expect(listAuditLogForTarget).not.toHaveBeenCalled();
  });

  it("falls back to the recent feed with no filters", async () => {
    mockAdminSession();
    vi.mocked(listRecentAuditLog).mockResolvedValue([]);

    await GET(makeGetRequest());

    expect(listRecentAuditLog).toHaveBeenCalledWith({ actionType: undefined });
  });

  it("passes a valid actionType through to the recent feed", async () => {
    mockAdminSession();
    vi.mocked(listRecentAuditLog).mockResolvedValue([]);

    await GET(makeGetRequest("?actionType=user_banned"));

    expect(listRecentAuditLog).toHaveBeenCalledWith({ actionType: "user_banned" });
  });
});

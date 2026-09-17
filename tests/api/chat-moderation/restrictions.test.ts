import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Validates GET/POST /api/admin/chat-moderation/restrictions and PATCH .../[id]:
// gated by CHAT_MODERATION, a mute requires durationHours while a ban is indefinite,
// and every mutation is attributed to the session (never the request body).

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }));
vi.mock("@/features/chat-moderation/db/restrictions", () => ({
  issueRestriction: vi.fn(),
  listRestrictions: vi.fn(),
  liftRestriction: vi.fn(),
  RestrictionNotFoundError: class RestrictionNotFoundError extends Error {},
}));

const { auth } = await import("@/lib/auth");
const { checkInternalAccess } = await import("@/features/rbac/db/permissions");
const { issueRestriction, listRestrictions, liftRestriction, RestrictionNotFoundError } = await import(
  "@/features/chat-moderation/db/restrictions"
);
const { GET, POST } = await import("@/app/api/admin/chat-moderation/restrictions/route");
const { PATCH } = await import("@/app/api/admin/chat-moderation/restrictions/[id]/route");

function makeContext(id = "restriction-1") {
  return { params: Promise.resolve({ id }) };
}

function makeGetRequest(query = ""): NextRequest {
  return new Request(`http://localhost/api/admin/chat-moderation/restrictions${query}`) as unknown as NextRequest;
}

function makeJsonRequest(method: string, body: unknown, url = "http://localhost/api/admin/chat-moderation/restrictions"): NextRequest {
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

describe("GET /api/admin/chat-moderation/restrictions", () => {
  it("returns 403 for an internal user without the CHAT_MODERATION key", async () => {
    mockInternalWithoutKey();
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it("defaults to activeOnly=true and no userId filter", async () => {
    mockAdminSession();
    vi.mocked(listRestrictions).mockResolvedValue([]);

    await GET(makeGetRequest());

    expect(listRestrictions).toHaveBeenCalledWith({ userId: undefined, activeOnly: true });
  });

  it("passes userId and activeOnly=false through from the query string", async () => {
    mockAdminSession();
    vi.mocked(listRestrictions).mockResolvedValue([]);

    await GET(makeGetRequest("?userId=user-9&activeOnly=false"));

    expect(listRestrictions).toHaveBeenCalledWith({ userId: "user-9", activeOnly: false });
  });
});

describe("POST /api/admin/chat-moderation/restrictions", () => {
  it("returns 400 when a mute is requested without durationHours", async () => {
    mockAdminSession();

    const res = await POST(
      makeJsonRequest("POST", { userId: "user-1", restrictionType: "mute", reason: "spam" })
    );

    expect(res.status).toBe(400);
    expect(issueRestriction).not.toHaveBeenCalled();
  });

  it("issues an indefinite ban (expiresAt null) attributed to the session admin", async () => {
    mockAdminSession();
    vi.mocked(issueRestriction).mockResolvedValue({ id: "r1" } as never);

    const res = await POST(
      makeJsonRequest("POST", {
        userId: "user-1",
        restrictionType: "ban",
        reason: "repeated abuse",
        issuedByAdminId: "someone-else",
      })
    );

    expect(res.status).toBe(200);
    expect(issueRestriction).toHaveBeenCalledWith({
      userId: "user-1",
      restrictionType: "ban",
      reason: "repeated abuse",
      expiresAt: null,
      issuedByAdminId: "admin-1",
    });
  });

  it("issues a mute with expiresAt derived from durationHours", async () => {
    mockAdminSession();
    vi.mocked(issueRestriction).mockResolvedValue({ id: "r1" } as never);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    await POST(
      makeJsonRequest("POST", {
        userId: "user-1",
        restrictionType: "mute",
        reason: "spam",
        durationHours: 24,
      })
    );

    expect(issueRestriction).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: new Date("2026-01-02T00:00:00.000Z") })
    );
    vi.useRealTimers();
  });
});

describe("PATCH /api/admin/chat-moderation/restrictions/[id]", () => {
  it("returns 400 when liftReason is missing", async () => {
    mockAdminSession();

    const res = await PATCH(makeJsonRequest("PATCH", {}), makeContext());

    expect(res.status).toBe(400);
    expect(liftRestriction).not.toHaveBeenCalled();
  });

  it("returns 404 when the restriction doesn't exist", async () => {
    mockAdminSession();
    vi.mocked(liftRestriction).mockRejectedValue(new RestrictionNotFoundError("not found"));

    const res = await PATCH(makeJsonRequest("PATCH", { liftReason: "resolved" }), makeContext());

    expect(res.status).toBe(404);
  });

  it("lifts the restriction, attributing liftedByAdminId to the session", async () => {
    mockAdminSession();
    vi.mocked(liftRestriction).mockResolvedValue(undefined);

    const res = await PATCH(makeJsonRequest("PATCH", { liftReason: "appeal accepted" }), makeContext());

    expect(res.status).toBe(200);
    expect(liftRestriction).toHaveBeenCalledWith({
      restrictionId: "restriction-1",
      liftedByAdminId: "admin-1",
      liftReason: "appeal accepted",
    });
  });
});

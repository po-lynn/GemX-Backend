import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/chat/db/admin-all-conversations", () => ({
  markAdminChatSeen: vi.fn(),
}));

const { auth } = await import("@/lib/auth");
const { markAdminChatSeen } = await import("@/features/chat/db/admin-all-conversations");
const { PATCH } = await import("@/app/api/admin/chat/seen/route");

function makeRequest(): NextRequest {
  return new Request("http://localhost/api/admin/chat/seen", { method: "PATCH" }) as unknown as NextRequest;
}

describe("PATCH /api/admin/chat/seen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Validates the auth boundary: no session → 401, cursor never touched.
  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await PATCH(makeRequest());
    expect(res.status).toBe(401);
    expect(markAdminChatSeen).not.toHaveBeenCalled();
  });

  // Validates the strict admin-only gate: internal staff have no oversight cursor to mark.
  it("returns 403 for role internal", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "staff-1", role: "internal" },
    } as never);
    const res = await PATCH(makeRequest());
    expect(res.status).toBe(403);
    expect(markAdminChatSeen).not.toHaveBeenCalled();
  });

  // Validates the happy path: the caller's own id is what gets marked seen.
  it("marks the calling admin's cursor as seen", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);
    vi.mocked(markAdminChatSeen).mockResolvedValue(undefined);

    const res = await PATCH(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(markAdminChatSeen).toHaveBeenCalledWith("admin-1");
  });

  // Validates a write failure surfaces as a 500 rather than an unhandled rejection.
  it("returns 500 when the update throws", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);
    vi.mocked(markAdminChatSeen).mockRejectedValue(new Error("db down"));

    const res = await PATCH(makeRequest());
    expect(res.status).toBe(500);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Validates the canned-responses CRUD routes: gated by the same ESCROW_CASES feature
// key as the case list/create routes (not a separate settings key), and that
// creating one always attributes createdByAdminId to the session, never the body.

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }));
vi.mock("@/features/escrow-cases/db/canned-responses", () => ({
  listEscrowCannedResponses: vi.fn(),
  createEscrowCannedResponse: vi.fn(),
  updateEscrowCannedResponse: vi.fn(),
  deleteEscrowCannedResponse: vi.fn(),
}));

const { auth } = await import("@/lib/auth");
const { checkInternalAccess } = await import("@/features/rbac/db/permissions");
const {
  listEscrowCannedResponses,
  createEscrowCannedResponse,
  updateEscrowCannedResponse,
  deleteEscrowCannedResponse,
} = await import("@/features/escrow-cases/db/canned-responses");
const { GET, POST } = await import("@/app/api/admin/escrow-canned-responses/route");
const { PATCH, DELETE } = await import("@/app/api/admin/escrow-canned-responses/[id]/route");

function makeContext(id = "resp-1") {
  return { params: Promise.resolve({ id }) };
}

function makeGetRequest(query = ""): NextRequest {
  return new Request(`http://localhost/api/admin/escrow-canned-responses${query}`) as unknown as NextRequest;
}

function makeJsonRequest(method: string, body: unknown, url = "http://localhost/api/admin/escrow-canned-responses"): NextRequest {
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

describe("GET /api/admin/escrow-canned-responses", () => {
  it("returns 403 for an internal user without the ESCROW_CASES key", async () => {
    mockInternalWithoutKey();

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(403);
  });

  it("defaults to activeOnly=true", async () => {
    mockAdminSession();
    vi.mocked(listEscrowCannedResponses).mockResolvedValue([]);

    await GET(makeGetRequest());

    expect(listEscrowCannedResponses).toHaveBeenCalledWith(true);
  });

  it("passes activeOnly=false when explicitly requested (admin config page)", async () => {
    mockAdminSession();
    vi.mocked(listEscrowCannedResponses).mockResolvedValue([]);

    await GET(makeGetRequest("?activeOnly=false"));

    expect(listEscrowCannedResponses).toHaveBeenCalledWith(false);
  });
});

describe("POST /api/admin/escrow-canned-responses", () => {
  it("attributes createdByAdminId to the session, never the request body", async () => {
    mockAdminSession();
    vi.mocked(createEscrowCannedResponse).mockResolvedValue({
      id: "resp-1",
      title: "Handover reminder",
      bodyEn: "Please confirm handover",
      bodyMy: "လွှဲပြောင်းမှုကို အတည်ပြုပေးပါ",
      isActive: true,
      sortOrder: 0,
      createdByAdminId: "admin-1",
      createdAt: "2026-09-16T00:00:00.000Z",
      updatedAt: "2026-09-16T00:00:00.000Z",
    });

    await POST(
      makeJsonRequest("POST", {
        title: "Handover reminder",
        bodyEn: "Please confirm handover",
        bodyMy: "လွှဲပြောင်းမှုကို အတည်ပြုပေးပါ",
        createdByAdminId: "someone-else",
      })
    );

    expect(createEscrowCannedResponse).toHaveBeenCalledWith(
      expect.objectContaining({ createdByAdminId: "admin-1" })
    );
  });

  it("returns 400 when bodyMy is missing", async () => {
    mockAdminSession();

    const res = await POST(makeJsonRequest("POST", { title: "x", bodyEn: "y" }));

    expect(res.status).toBe(400);
    expect(createEscrowCannedResponse).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/escrow-canned-responses/[id]", () => {
  it("returns 404 when the id doesn't exist", async () => {
    mockAdminSession();
    vi.mocked(updateEscrowCannedResponse).mockResolvedValue(null);

    const res = await PATCH(makeJsonRequest("PATCH", { isActive: false }), makeContext());

    expect(res.status).toBe(404);
  });

  it("returns 400 for an empty update body", async () => {
    mockAdminSession();

    const res = await PATCH(makeJsonRequest("PATCH", {}), makeContext());

    expect(res.status).toBe(400);
    expect(updateEscrowCannedResponse).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/escrow-canned-responses/[id]", () => {
  it("returns 404 when nothing was deleted", async () => {
    mockAdminSession();
    vi.mocked(deleteEscrowCannedResponse).mockResolvedValue(false);

    const res = await DELETE(makeJsonRequest("DELETE", {}), makeContext());

    expect(res.status).toBe(404);
  });

  it("returns 403 for an internal user without the ESCROW_CASES key", async () => {
    mockInternalWithoutKey();

    const res = await DELETE(makeJsonRequest("DELETE", {}), makeContext());

    expect(res.status).toBe(403);
    expect(deleteEscrowCannedResponse).not.toHaveBeenCalled();
  });
});

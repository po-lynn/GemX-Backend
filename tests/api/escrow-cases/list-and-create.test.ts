import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// This file validates the row-level SCOPE decision made in GET (admin/supervisor see every
// case, a plain escrow_agent sees only their own) and the guard + validation on POST create.
// The scope decision lives in the route itself (not case-access.ts, which is per-case), so
// these tests exercise it directly against listEscrowCasesForViewer's `assignedAgentId` arg.

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }));
vi.mock("@/features/staff-roles/db/staff-roles", () => ({ getStaffRole: vi.fn() }));
vi.mock("@/features/escrow-cases/db/escrow-cases", () => ({
  listEscrowCasesForViewer: vi.fn(),
  createEscrowCase: vi.fn(),
}));

const { auth } = await import("@/lib/auth");
const { checkInternalAccess } = await import("@/features/rbac/db/permissions");
const { getStaffRole } = await import("@/features/staff-roles/db/staff-roles");
const { listEscrowCasesForViewer, createEscrowCase } = await import(
  "@/features/escrow-cases/db/escrow-cases"
);
const { GET, POST } = await import("@/app/api/admin/escrow-cases/route");

function makeGetRequest(): NextRequest {
  return new Request("http://localhost/api/admin/escrow-cases") as unknown as NextRequest;
}

function makePostRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/admin/escrow-cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const createBody = {
  buyerId: "buyer-1",
  sellerId: "seller-1",
  listingId: "listing-1",
  agreedPriceMinor: 100000,
  currency: "USD",
};

const createdCase = {
  id: "case-1",
  buyerId: "buyer-1",
  sellerId: "seller-1",
  listingId: "listing-1",
  assignedAgentId: null,
  state: "requested" as const,
};

describe("GET /api/admin/escrow-cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Validates the endpoint is unauthenticated-safe: no session -> 401, no DB query.
  it("returns 401 without a session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
    expect(listEscrowCasesForViewer).not.toHaveBeenCalled();
  });

  // Validates the feature-key gate: role "internal" without the ESCROW_CASES key is
  // rejected before the scope decision (and before any case list is loaded).
  it("returns 403 for role internal without the ESCROW_CASES feature key", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "staff-1", role: "internal" },
    } as never);
    vi.mocked(checkInternalAccess).mockResolvedValue(false);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
    expect(listEscrowCasesForViewer).not.toHaveBeenCalled();
  });

  // Validates the admin path: role "admin" skips the staff-role lookup entirely and sees
  // every case (assignedAgentId passed through as undefined -> no scoping filter).
  it("returns 200 for role admin and lists every case (assignedAgentId undefined)", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);
    vi.mocked(listEscrowCasesForViewer).mockResolvedValue([]);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(getStaffRole).not.toHaveBeenCalled();
    expect(listEscrowCasesForViewer).toHaveBeenCalledWith({
      viewerId: "admin-1",
      assignedAgentId: undefined,
    });
  });

  // Validates the plain-agent scoping path when no staff_role row exists at all: with no
  // row, isSupervisor can't be true, so the viewer is scoped to only their own cases.
  it("scopes to the caller's own cases when role internal holds the key but has no staff_role row", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "agent-1", role: "internal" },
    } as never);
    vi.mocked(checkInternalAccess).mockResolvedValue(true);
    vi.mocked(getStaffRole).mockResolvedValue(null);
    vi.mocked(listEscrowCasesForViewer).mockResolvedValue([]);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    expect(listEscrowCasesForViewer).toHaveBeenCalledWith({
      viewerId: "agent-1",
      assignedAgentId: "agent-1",
    });
  });

  // Validates the plain-agent scoping path when a staff_role row exists but isSupervisor
  // is explicitly false: still scoped to the caller's own assigned cases.
  it("scopes to the caller's own cases when staff_role.isSupervisor is false", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "agent-1", role: "internal" },
    } as never);
    vi.mocked(checkInternalAccess).mockResolvedValue(true);
    vi.mocked(getStaffRole).mockResolvedValue({
      userId: "agent-1",
      role: "escrow_agent",
      isSupervisor: false,
    });
    vi.mocked(listEscrowCasesForViewer).mockResolvedValue([]);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    expect(listEscrowCasesForViewer).toHaveBeenCalledWith({
      viewerId: "agent-1",
      assignedAgentId: "agent-1",
    });
  });

  // Validates the supervisor path: staff_role.isSupervisor = true sees every case, just
  // like an admin (assignedAgentId undefined -> no scoping filter).
  it("sees every case when staff_role.isSupervisor is true", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "super-1", role: "internal" },
    } as never);
    vi.mocked(checkInternalAccess).mockResolvedValue(true);
    vi.mocked(getStaffRole).mockResolvedValue({
      userId: "super-1",
      role: "escrow_agent",
      isSupervisor: true,
    });
    vi.mocked(listEscrowCasesForViewer).mockResolvedValue([]);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    expect(listEscrowCasesForViewer).toHaveBeenCalledWith({
      viewerId: "super-1",
      assignedAgentId: undefined,
    });
  });
});

describe("POST /api/admin/escrow-cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);
  });

  // Validates the same-user guard: a case can't have the same buyer and seller.
  it("returns 400 when buyerId equals sellerId", async () => {
    const res = await POST(
      makePostRequest({ ...createBody, buyerId: "same-user", sellerId: "same-user" })
    );
    expect(res.status).toBe(400);
    expect(createEscrowCase).not.toHaveBeenCalled();
  });

  // Validates the happy path: a valid, distinct buyer/seller pair creates the case and
  // forwards exactly the parsed fields through to the db layer.
  it("returns 200 and creates the case for a valid distinct buyer/seller pair", async () => {
    vi.mocked(createEscrowCase).mockResolvedValue(createdCase);

    const res = await POST(makePostRequest(createBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.case).toEqual(createdCase);
    expect(createEscrowCase).toHaveBeenCalledWith({
      buyerId: "buyer-1",
      sellerId: "seller-1",
      listingId: "listing-1",
      assignedAgentId: null,
      agreedPriceMinor: 100000,
      currency: "USD",
    });
  });
});

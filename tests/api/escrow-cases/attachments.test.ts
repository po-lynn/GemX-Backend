import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Validates GET/POST /api/admin/escrow-cases/[id]/attachments: any access scope
// (including read-only "moderation") may review evidence, but a moderator can never
// add to it — same write/read split as the messages route.

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/features/staff-roles/db/staff-roles", () => ({ getStaffRole: vi.fn() }));
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }));
vi.mock("@/features/escrow-cases/db/escrow-cases", () => ({ getEscrowCaseById: vi.fn() }));
vi.mock("@/features/escrow-cases/db/case-attachments", () => ({
  listEscrowCaseAttachments: vi.fn(),
  createEscrowCaseAttachment: vi.fn(),
}));
vi.mock("@/lib/supabase/storage-upload", () => ({
  requireUploadContext: vi.fn(),
  storageObjectPath: vi.fn(() => "user-1/file.png"),
  uploadFileToBucket: vi.fn(),
  validateUploadFile: vi.fn(),
}));

const { auth } = await import("@/lib/auth");
const { getStaffRole } = await import("@/features/staff-roles/db/staff-roles");
const { checkInternalAccess } = await import("@/features/rbac/db/permissions");
const { getEscrowCaseById } = await import("@/features/escrow-cases/db/escrow-cases");
const { listEscrowCaseAttachments, createEscrowCaseAttachment } = await import(
  "@/features/escrow-cases/db/case-attachments"
);
const { requireUploadContext, uploadFileToBucket, validateUploadFile } = await import(
  "@/lib/supabase/storage-upload"
);
const { GET, POST } = await import("@/app/api/admin/escrow-cases/[id]/attachments/route");

function makeContext(id = "case-1") {
  return { params: Promise.resolve({ id }) };
}

function makeGetRequest(): NextRequest {
  return new Request("http://localhost/api/admin/escrow-cases/case-1/attachments") as unknown as NextRequest;
}

function makePostRequest(file?: File): NextRequest {
  const formData = new FormData();
  if (file) formData.set("file", file);
  return new Request("http://localhost/api/admin/escrow-cases/case-1/attachments", {
    method: "POST",
    body: formData,
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

function mockModeratorSession() {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "mod-1", role: "internal" } } as never);
  vi.mocked(getEscrowCaseById).mockResolvedValue(caseRow);
  vi.mocked(getStaffRole).mockResolvedValue({ userId: "mod-1", role: "moderator", isSupervisor: false });
  vi.mocked(checkInternalAccess).mockResolvedValue(true);
}

function mockAssignedAgentSession() {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "agent-1", role: "internal" } } as never);
  vi.mocked(getEscrowCaseById).mockResolvedValue(caseRow);
  vi.mocked(getStaffRole).mockResolvedValue({ userId: "agent-1", role: "escrow_agent", isSupervisor: false });
  vi.mocked(checkInternalAccess).mockResolvedValue(true);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/escrow-cases/[id]/attachments", () => {
  it("returns 200 for a moderator (read-only oversight includes reviewing evidence)", async () => {
    mockModeratorSession();
    vi.mocked(listEscrowCaseAttachments).mockResolvedValue([]);

    const res = await GET(makeGetRequest(), makeContext());

    expect(res.status).toBe(200);
  });
});

describe("POST /api/admin/escrow-cases/[id]/attachments", () => {
  it("returns 403 for a moderator (read-only scope can't add evidence)", async () => {
    mockModeratorSession();

    const res = await POST(makePostRequest(new File(["x"], "x.png", { type: "image/png" })), makeContext());

    expect(res.status).toBe(403);
    expect(createEscrowCaseAttachment).not.toHaveBeenCalled();
  });

  it("returns 400 when no file is provided", async () => {
    mockAssignedAgentSession();
    vi.mocked(requireUploadContext).mockResolvedValue({
      ctx: { user: { id: "agent-1", role: "internal" }, supabase: {} as never },
    } as never);

    const res = await POST(makePostRequest(), makeContext());

    expect(res.status).toBe(400);
  });

  it("returns 200 and records the attachment with the session user as uploader", async () => {
    mockAssignedAgentSession();
    vi.mocked(requireUploadContext).mockResolvedValue({
      ctx: { user: { id: "agent-1", role: "internal" }, supabase: {} as never },
    } as never);
    vi.mocked(validateUploadFile).mockResolvedValue(null);
    vi.mocked(uploadFileToBucket).mockResolvedValue({ url: "https://example.com/evidence.png" });
    vi.mocked(createEscrowCaseAttachment).mockResolvedValue({
      id: "att-1",
      caseId: "case-1",
      messageId: null,
      uploadedByUserId: "agent-1",
      url: "https://example.com/evidence.png",
      fileType: "image",
      label: null,
      createdAt: "2026-09-16T00:00:00.000Z",
    });

    const res = await POST(
      makePostRequest(new File(["x"], "evidence.png", { type: "image/png" })),
      makeContext()
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(createEscrowCaseAttachment).toHaveBeenCalledWith({
      caseId: "case-1",
      uploadedByUserId: "agent-1",
      url: "https://example.com/evidence.png",
      fileType: "image",
      label: null,
    });
  });
});

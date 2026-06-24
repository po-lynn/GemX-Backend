import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { POST } from "@/app/api/upload/kyc-document/route"

vi.mock("@/lib/supabase/storage-upload", () => ({
  requireUploadContext: vi.fn(),
  validateUploadFile: vi.fn().mockReturnValue(null),
  storageObjectPath: vi.fn().mockReturnValue("user-1/abc.jpg"),
  uploadFileToBucket: vi.fn(),
}))
vi.mock("@/lib/supabase/server", () => ({
  KYC_DOCUMENTS_BUCKET: "kyc-documents",
}))

import {
  requireUploadContext,
  validateUploadFile,
  uploadFileToBucket,
} from "@/lib/supabase/storage-upload"

function makeReq(formData: FormData): NextRequest {
  return { headers: new Headers(), formData: () => Promise.resolve(formData) } as unknown as NextRequest
}

describe("POST /api/upload/kyc-document", () => {
  const fakeCtx = { user: { id: "user-1", role: "user" }, supabase: {} }

  beforeEach(() => {
    vi.mocked(requireUploadContext).mockResolvedValue({ ctx: fakeCtx as never })
    vi.mocked(validateUploadFile).mockResolvedValue(null)
    vi.mocked(uploadFileToBucket).mockResolvedValue({ url: "https://example.com/kyc-documents/user-1/abc.jpg", error: undefined })
  })

  it("returns 401 when not authenticated", async () => {
    // requireUploadContext returns an error Response when unauth
    vi.mocked(requireUploadContext).mockResolvedValue({
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    } as never)
    const fd = new FormData()
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(401)
  })

  it("returns 400 when no file provided", async () => {
    const fd = new FormData() // no file
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no file/i)
  })

  it("returns 400 when file type is invalid", async () => {
    vi.mocked(validateUploadFile).mockResolvedValue(
      Response.json({ error: "Invalid file type" }, { status: 400 })
    )
    const fd = new FormData()
    fd.append("file", new File(["x"], "doc.txt", { type: "text/plain" }))
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(400)
  })

  it("returns 200 with url on valid JPEG upload", async () => {
    const fd = new FormData()
    fd.append("file", new File(["x"], "nrc.jpg", { type: "image/jpeg" }))
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe("https://example.com/kyc-documents/user-1/abc.jpg")
  })

  it("returns 200 with url on valid PDF upload", async () => {
    const fd = new FormData()
    fd.append("file", new File(["x"], "license.pdf", { type: "application/pdf" }))
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toMatch(/^https/)
  })
})

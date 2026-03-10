import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { POST } from "@/app/api/upload/certificate/route"
import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase/server"

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn(),
  getSupabaseAdminErrorMessage: vi.fn(() => "Supabase not configured."),
  PRODUCT_CERTIFICATES_BUCKET: "product-certificates",
}))

describe("POST /api/upload/certificate", () => {
  beforeEach(() => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    vi.mocked(getSupabaseAdmin).mockReturnValue(null)
  })

  it("returns 401 when not authenticated", async () => {
    const formData = new FormData()
    formData.append("file", new File(["x"], "report.pdf", { type: "application/pdf" }))
    const req = new Request("http://localhost/api/upload/certificate", {
      method: "POST",
      body: formData,
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data).toHaveProperty("error", "Unauthorized. Sign in to upload files.")
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it("returns 503 when Supabase is not configured", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as never)
    vi.mocked(getSupabaseAdmin).mockReturnValue(null)
    const formData = new FormData()
    formData.append("file", new File(["x"], "report.pdf", { type: "application/pdf" }))
    const req = new Request("http://localhost/api/upload/certificate", {
      method: "POST",
      body: formData,
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data).toHaveProperty("error")
    expect(getSupabaseAdmin).toHaveBeenCalled()
  })

  it("returns 400 when no file provided", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as never)
    vi.mocked(getSupabaseAdmin).mockReturnValue({} as never)
    const formData = new FormData()
    const req = new Request("http://localhost/api/upload/certificate", {
      method: "POST",
      body: formData,
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data).toHaveProperty("error")
    expect(data.error).toMatch(/file/i)
  })

  it("returns 200 and url when authenticated, Supabase mocked, and valid PDF", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as never)
    const mockUpload = vi.fn().mockResolvedValue({ error: null })
    const mockGetPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://storage.example.com/product-certificates/user-1/abc.pdf" },
    })
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      storage: {
        from: () => ({
          upload: mockUpload,
          getPublicUrl: mockGetPublicUrl,
        }),
      },
    } as never)
    const formData = new FormData()
    formData.append("file", new File(["x"], "report.pdf", { type: "application/pdf" }))
    const req = new Request("http://localhost/api/upload/certificate", {
      method: "POST",
      body: formData,
    })
    const res = await POST(req as NextRequest)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty("url", "https://storage.example.com/product-certificates/user-1/abc.pdf")
    expect(mockUpload).toHaveBeenCalled()
  })
})

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

  // Success path (200 + url) depends on Request.formData() + File.arrayBuffer() which
  // can behave inconsistently in Node/Vitest; test via browser or curl (see docs/TESTING-UPLOADS.md).
})

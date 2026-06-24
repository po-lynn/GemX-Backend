import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getSupabaseAdmin } from "@/lib/supabase/server"
import {
  requireUploadContext,
  storageObjectPath,
  uploadFileToBucket,
  validateUploadFile,
} from "@/lib/supabase/storage-upload"

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn(),
  getSupabaseAdminErrorMessage: vi.fn(() => "Supabase not configured."),
}))

function makeRequest(): NextRequest {
  return new Request("http://localhost/api/upload/x", { method: "POST" }) as NextRequest
}

describe("requireUploadContext", () => {
  beforeEach(() => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    vi.mocked(getSupabaseAdmin).mockReturnValue(null)
  })

  // Unauthenticated requests get the standard upload 401 without touching Supabase
  it("returns 401 Response when no session", async () => {
    const result = await requireUploadContext(makeRequest())
    expect(result.error?.status).toBe(401)
    const data = await result.error!.json()
    expect(data.error).toBe("Unauthorized. Sign in to upload files.")
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
  })

  // Missing/misconfigured service role key surfaces as 503 with the config hint
  it("returns 503 Response when Supabase admin is not configured", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "u1" } } as never)
    const result = await requireUploadContext(makeRequest())
    expect(result.error?.status).toBe(503)
  })

  // Happy path exposes the session user and the admin client to the route
  it("returns user and supabase client when authenticated and configured", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "u1", role: "admin" },
    } as never)
    const fakeClient = { storage: {} }
    vi.mocked(getSupabaseAdmin).mockReturnValue(fakeClient as never)
    const result = await requireUploadContext(makeRequest())
    expect(result.ctx?.user.id).toBe("u1")
    expect(result.ctx?.supabase).toBe(fakeClient)
  })
})

describe("validateUploadFile", () => {
  const ALLOWED = ["image/png"]
  // Minimal valid PNG: starts with the 8-byte PNG signature
  const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

  // Disallowed MIME types are rejected with a 400 listing the allowed types
  it("returns 400 for a disallowed MIME type", async () => {
    const file = new File(["x"], "a.exe", { type: "application/octet-stream" })
    const res = await validateUploadFile(file, ALLOWED, 1024)
    expect(res?.status).toBe(400)
    const data = await res!.json()
    expect(data.error).toContain("Invalid file type")
    expect(data.error).toContain("image/png")
  })

  // Oversized files are rejected before reaching the magic-byte check
  it("returns 400 for an oversized file", async () => {
    const file = new File([PNG_HEADER], "a.png", { type: "image/png" })
    const res = await validateUploadFile(file, ALLOWED, 1)
    expect(res?.status).toBe(400)
    const data = await res!.json()
    expect(data.error).toContain("File too large")
  })

  // Files whose bytes don't match the declared MIME type are rejected
  it("returns 400 when file content does not match declared type", async () => {
    const file = new File(["not a png"], "a.png", { type: "image/png" })
    const res = await validateUploadFile(file, ALLOWED, 1024)
    expect(res?.status).toBe(400)
    const data = await res!.json()
    expect(data.error).toContain("does not match declared type")
  })

  // Valid files with correct magic bytes return null (no error Response)
  it("returns null for a valid file with correct magic bytes", async () => {
    const file = new File([PNG_HEADER], "a.png", { type: "image/png" })
    expect(await validateUploadFile(file, ALLOWED, 1024)).toBeNull()
  })
})

describe("storageObjectPath", () => {
  // Path is namespaced by user id and keeps the original extension
  it("uses the file extension when present", () => {
    const file = new File(["x"], "photo.webp", { type: "image/webp" })
    const path = storageObjectPath("u1", file, "jpg")
    expect(path).toMatch(/^u1\/[0-9a-f-]{36}\.webp$/)
  })

  // Files without an extension fall back to the route's default
  it("falls back to the provided extension", () => {
    const file = new File(["x"], "photo", { type: "image/jpeg" })
    const path = storageObjectPath("u1", file, "jpg")
    expect(path).toMatch(/\.jpg$/)
  })

  // Chat media prefixes a timestamp to keep names sortable/unique under load
  it("prefixes a timestamp when requested", () => {
    const file = new File(["x"], "voice.webm", { type: "audio/webm" })
    const path = storageObjectPath("u1", file, "bin", { timestamped: true })
    expect(path).toMatch(/^u1\/\d+-[0-9a-f-]{36}\.webm$/)
  })
})

describe("uploadFileToBucket", () => {
  function makeStorage(uploadResults: Array<{ error: unknown }>, createBucketError: unknown = null) {
    const upload = vi.fn()
    for (const r of uploadResults) upload.mockResolvedValueOnce(r)
    const createBucket = vi.fn().mockResolvedValue({ error: createBucketError })
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: "https://cdn/x.png" } })
    return {
      client: { storage: { from: () => ({ upload, getPublicUrl }), createBucket } },
      upload,
      createBucket,
    }
  }
  const file = new File(["x"], "a.png", { type: "image/png" })

  // Happy path returns the public URL
  it("uploads and returns the public URL", async () => {
    const { client } = makeStorage([{ error: null }])
    const result = await uploadFileToBucket(client as never, {
      bucket: "b",
      path: "u1/a.png",
      file,
    })
    expect(result.url).toBe("https://cdn/x.png")
  })

  // Missing bucket is created (public) and the upload retried exactly once
  it("creates the bucket and retries when missing and createBucketIfMissing is set", async () => {
    const { client, upload, createBucket } = makeStorage([
      { error: { message: "Bucket not found" } },
      { error: null },
    ])
    const result = await uploadFileToBucket(client as never, {
      bucket: "b",
      path: "u1/a.png",
      file,
      createBucketIfMissing: true,
    })
    expect(createBucket).toHaveBeenCalledWith("b", { public: true })
    expect(upload).toHaveBeenCalledTimes(2)
    expect(result.url).toBe("https://cdn/x.png")
  })

  // Without the flag, a missing bucket is a plain 500 error (no create attempt)
  it("does not create the bucket when createBucketIfMissing is not set", async () => {
    const { client, createBucket } = makeStorage([{ error: { message: "Bucket not found" } }])
    const result = await uploadFileToBucket(client as never, {
      bucket: "b",
      path: "u1/a.png",
      file,
    })
    expect(createBucket).not.toHaveBeenCalled()
    expect(result.error?.status).toBe(500)
  })

  // RLS misconfiguration produces the actionable service-role guidance
  it("returns the RLS guidance message on row-level security errors", async () => {
    const { client } = makeStorage([
      { error: { message: "new row violates row-level security policy" } },
    ])
    const result = await uploadFileToBucket(client as never, {
      bucket: "user-images",
      path: "u1/a.png",
      file,
    })
    expect(result.error?.status).toBe(500)
    const data = await result.error!.json()
    expect(data.error).toContain("SUPABASE_SERVICE_ROLE_KEY")
    expect(data.error).toContain("user-images")
  })
})

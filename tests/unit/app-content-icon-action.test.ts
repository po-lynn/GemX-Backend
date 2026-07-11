import { beforeEach, describe, expect, it, vi } from "vitest"
import { uploadAppContentIconAction } from "@/features/app-content/actions/app-content-icon"
import { requireActionRole } from "@/lib/action-guard"
import { getSupabaseAdmin, getSupabaseAdminErrorMessage } from "@/lib/supabase/server"
import { validateUploadFile, storageObjectPath, uploadFileToBucket } from "@/lib/supabase/storage-upload"

vi.mock("@/lib/action-guard", () => ({ requireActionRole: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({
  APP_CONTENT_ICONS_BUCKET: "app-content-icons",
  getSupabaseAdmin: vi.fn(),
  getSupabaseAdminErrorMessage: vi.fn().mockReturnValue("Supabase upload not configured."),
}))
vi.mock("@/lib/supabase/storage-upload", () => ({
  validateUploadFile: vi.fn(),
  storageObjectPath: vi.fn().mockReturnValue("admin-1/abc.png"),
  uploadFileToBucket: vi.fn(),
}))

function fd(file?: File): FormData {
  const f = new FormData()
  if (file) f.set("file", file)
  return f
}

const PNG = new File(["x"], "icon.png", { type: "image/png" })

describe("uploadAppContentIconAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireActionRole).mockResolvedValue({ user: { id: "admin-1" } } as never)
    vi.mocked(validateUploadFile).mockResolvedValue(null)
    vi.mocked(getSupabaseAdmin).mockReturnValue({} as never)
    vi.mocked(uploadFileToBucket).mockResolvedValue({
      url: "https://example.com/app-content-icons/admin-1/abc.png",
    })
  })

  it("returns Unauthorized when the session check fails", async () => {
    vi.mocked(requireActionRole).mockResolvedValue(null as never)
    const result = await uploadAppContentIconAction(fd(PNG))
    expect(result).toEqual({ error: "Unauthorized" })
    expect(uploadFileToBucket).not.toHaveBeenCalled()
  })

  it("returns an error when no file is provided", async () => {
    const result = await uploadAppContentIconAction(fd())
    expect(result).toEqual({ error: "No file provided" })
  })

  it("returns an error when the file fails validation", async () => {
    vi.mocked(validateUploadFile).mockResolvedValue(
      Response.json({ error: "Invalid file type" }, { status: 400 })
    )
    const result = await uploadAppContentIconAction(fd(PNG))
    expect(result).toEqual({ error: "Invalid file type" })
    expect(uploadFileToBucket).not.toHaveBeenCalled()
  })

  it("returns an error when Supabase admin is not configured", async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(null)
    const result = await uploadAppContentIconAction(fd(PNG))
    expect(result).toEqual({ error: "Supabase upload not configured." })
  })

  it("returns the url on a successful upload", async () => {
    const result = await uploadAppContentIconAction(fd(PNG))
    expect(result).toEqual({ url: "https://example.com/app-content-icons/admin-1/abc.png" })
    expect(uploadFileToBucket).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ bucket: "app-content-icons", path: "admin-1/abc.png", file: PNG })
    )
  })

  it("returns an error when the storage upload itself fails", async () => {
    vi.mocked(uploadFileToBucket).mockResolvedValue({
      error: Response.json({ error: "Upload failed" }, { status: 500 }),
    })
    const result = await uploadAppContentIconAction(fd(PNG))
    expect(result).toEqual({ error: "Upload failed" })
  })
})

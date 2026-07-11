import { beforeEach, describe, expect, it, vi } from "vitest"
import { saveAppContentAction, publishAppContentAction } from "@/features/app-content/actions/app-content"
import { requireActionRole } from "@/lib/action-guard"
import { saveAppContentDraft, publishAppContentSections } from "@/features/app-content/db/app-content"
import { revalidateAppContentCache } from "@/features/app-content/db/cache/app-content"
import { DEFAULT_ABOUT_US_CONTENT } from "@/features/app-content/db/app-content"

vi.mock("@/lib/action-guard", () => ({ requireActionRole: vi.fn() }))
vi.mock("@/features/app-content/db/app-content", async () => {
  const actual = await vi.importActual<typeof import("@/features/app-content/db/app-content")>(
    "@/features/app-content/db/app-content"
  )
  return {
    ...actual,
    saveAppContentDraft: vi.fn(),
    publishAppContentSections: vi.fn(),
  }
})
vi.mock("@/features/app-content/db/cache/app-content", () => ({
  revalidateAppContentCache: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireActionRole).mockResolvedValue({ user: { id: "admin-1", name: "Elena M." } } as never)
})

describe("saveAppContentAction", () => {
  it("saves the provided section and returns success", async () => {
    vi.mocked(saveAppContentDraft).mockResolvedValue(undefined)
    const result = await saveAppContentAction({ aboutUs: DEFAULT_ABOUT_US_CONTENT })
    expect(result).toEqual({ success: true })
    expect(saveAppContentDraft).toHaveBeenCalledWith({
      aboutUs: DEFAULT_ABOUT_US_CONTENT,
      followUs: undefined,
      helpSupport: undefined,
      updatedByName: "Elena M.",
    })
  })

  it("returns an error when no section is provided", async () => {
    const result = await saveAppContentAction({})
    expect(result).toEqual({ error: "Nothing to save" })
    expect(saveAppContentDraft).not.toHaveBeenCalled()
  })

  it("returns an error for invalid content", async () => {
    const result = await saveAppContentAction({
      aboutUs: { ...DEFAULT_ABOUT_US_CONTENT, storyHeading: "" },
    })
    expect(result).toHaveProperty("error")
    expect(saveAppContentDraft).not.toHaveBeenCalled()
  })

  it("returns Unauthorized when the session check fails", async () => {
    vi.mocked(requireActionRole).mockResolvedValue(null as never)
    const result = await saveAppContentAction({ aboutUs: DEFAULT_ABOUT_US_CONTENT })
    expect(result).toEqual({ error: "Unauthorized" })
    expect(saveAppContentDraft).not.toHaveBeenCalled()
  })
})

describe("publishAppContentAction", () => {
  it("publishes and revalidates the cache", async () => {
    vi.mocked(publishAppContentSections).mockResolvedValue({ published: ["about_us"] })
    const result = await publishAppContentAction()
    expect(result).toEqual({ success: true, published: ["about_us"] })
    expect(revalidateAppContentCache).toHaveBeenCalled()
  })

  it("returns an error when nothing is pending", async () => {
    vi.mocked(publishAppContentSections).mockResolvedValue({ published: [] })
    const result = await publishAppContentAction()
    expect(result).toEqual({ error: "Nothing to publish" })
    expect(revalidateAppContentCache).not.toHaveBeenCalled()
  })

  it("returns Unauthorized when the session check fails", async () => {
    vi.mocked(requireActionRole).mockResolvedValue(null as never)
    const result = await publishAppContentAction()
    expect(result).toEqual({ error: "Unauthorized" })
    expect(publishAppContentSections).not.toHaveBeenCalled()
  })
})

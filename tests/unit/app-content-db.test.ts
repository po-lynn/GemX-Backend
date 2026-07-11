import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/drizzle/db"
import {
  getAppContentSections,
  saveAppContentDraft,
  publishAppContentSections,
  getPublishedAboutUs,
  DEFAULT_ABOUT_US_CONTENT,
  DEFAULT_FOLLOW_US_CONTENT,
  DEFAULT_HELP_SUPPORT_CONTENT,
} from "@/features/app-content/db/app-content"

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => `eq:${val}`),
}))

vi.mock("@/drizzle/schema/app-content-schema", () => ({
  appContentSection: {
    id: "id",
    section: "section",
    draftContent: "draft_content",
    publishedContent: "published_content",
    hasUnpublishedChanges: "has_unpublished_changes",
    updatedAt: "updated_at",
    updatedByName: "updated_by_name",
    publishedAt: "published_at",
    publishedByName: "published_by_name",
  },
}))

vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}))

function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  for (const m of ["from", "where", "limit"]) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(resolve, reject)
  return chain
}

const NOW = new Date("2026-07-11T00:00:00.000Z")

describe("getAppContentSections", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns defaults for sections with no row yet", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never)
    const result = await getAppContentSections()
    expect(result.aboutUs.draftContent).toEqual(DEFAULT_ABOUT_US_CONTENT)
    expect(result.followUs.draftContent).toEqual(DEFAULT_FOLLOW_US_CONTENT)
    expect(result.helpSupport.draftContent).toEqual(DEFAULT_HELP_SUPPORT_CONTENT)
    expect(result.aboutUs.hasUnpublishedChanges).toBe(false)
    expect(result.aboutUs.publishedContent).toBeNull()
  })

  it("maps an existing row onto its section", async () => {
    const aboutUsContent = { ...DEFAULT_ABOUT_US_CONTENT, companyName: "GemX Ltd." }
    vi.mocked(db.select).mockReturnValueOnce(
      selectChain([
        {
          section: "about_us",
          draftContent: aboutUsContent,
          publishedContent: null,
          hasUnpublishedChanges: true,
          updatedAt: NOW,
          updatedByName: "Elena M.",
          publishedAt: null,
          publishedByName: null,
        },
      ]) as never
    )
    const result = await getAppContentSections()
    expect(result.aboutUs.draftContent).toEqual(aboutUsContent)
    expect(result.aboutUs.hasUnpublishedChanges).toBe(true)
    expect(result.aboutUs.updatedByName).toBe("Elena M.")
    expect(result.followUs.draftContent).toEqual(DEFAULT_FOLLOW_US_CONTENT)
  })
})

describe("saveAppContentDraft", () => {
  beforeEach(() => vi.clearAllMocks())

  it("upserts only the sections that were provided", async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
    const insert = vi.fn().mockReturnValue({ values })
    const tx = { insert }
    vi.mocked(db.transaction).mockImplementation(async (fn) => fn(tx as never))

    await saveAppContentDraft({
      aboutUs: DEFAULT_ABOUT_US_CONTENT,
      updatedByName: "Elena M.",
    })

    expect(insert).toHaveBeenCalledTimes(1)
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "about_us",
        draftContent: DEFAULT_ABOUT_US_CONTENT,
        hasUnpublishedChanges: true,
        updatedByName: "Elena M.",
      })
    )
  })

  it("does nothing when no section is provided", async () => {
    await saveAppContentDraft({ updatedByName: "Elena M." })
    expect(db.transaction).not.toHaveBeenCalled()
  })
})

describe("publishAppContentSections", () => {
  beforeEach(() => vi.clearAllMocks())

  it("promotes only sections with pending changes and returns their names", async () => {
    const update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    })
    const tx = {
      select: vi.fn().mockReturnValue(
        selectChain([{ id: "row-1", section: "about_us", draftContent: DEFAULT_ABOUT_US_CONTENT }])
      ),
      update,
    }
    vi.mocked(db.transaction).mockImplementation(async (fn) => fn(tx as never))

    const result = await publishAppContentSections("Elena M.")
    expect(result.published).toEqual(["about_us"])
    expect(update).toHaveBeenCalledTimes(1)
  })

  it("returns an empty published list when nothing is pending", async () => {
    const tx = { select: vi.fn().mockReturnValue(selectChain([])), update: vi.fn() }
    vi.mocked(db.transaction).mockImplementation(async (fn) => fn(tx as never))

    const result = await publishAppContentSections("Elena M.")
    expect(result.published).toEqual([])
    expect(tx.update).not.toHaveBeenCalled()
  })
})

describe("getPublishedAboutUs", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns the default when never published", async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never)
    await expect(getPublishedAboutUs()).resolves.toEqual(DEFAULT_ABOUT_US_CONTENT)
  })

  it("returns the published snapshot when present", async () => {
    const content = { ...DEFAULT_ABOUT_US_CONTENT, companyName: "GemX Ltd." }
    vi.mocked(db.select).mockReturnValueOnce(selectChain([{ publishedContent: content }]) as never)
    await expect(getPublishedAboutUs()).resolves.toEqual(content)
  })
})

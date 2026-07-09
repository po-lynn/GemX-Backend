import { describe, it, expect, vi, beforeEach } from "vitest"
import { connection } from "next/server"
import { getNewsById } from "@/features/news/db/news"
import { generateMetadata } from "@/app/news/[id]/page"

vi.mock("next/server", () => ({
  connection: vi.fn(),
}))
vi.mock("@/features/news/db/news", () => ({
  getNewsById: vi.fn(),
}))

const params = (id: string) => Promise.resolve({ id })

const publishedNews = {
  id: "1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d",
  title: "New Verification Process",
  content: JSON.stringify([{ type: "paragraph", content: [{ type: "text", text: "We've updated verification." }] }]),
  author: "Gem X Newsroom",
  category: "general",
  coverImage: "https://cdn.example.com/news-cover.jpg",
  isFeatured: false,
  status: "published",
  publish: new Date("2026-06-01"),
  createdAt: new Date("2026-05-30"),
  updatedAt: new Date("2026-06-01"),
}

describe("generateMetadata for /news/[id]", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
  })

  // Published news with a cover image gets a full OG/Twitter card
  it("returns title, description, and image metadata for published news", async () => {
    vi.mocked(getNewsById).mockResolvedValue(publishedNews)
    const metadata = await generateMetadata({ params: params(publishedNews.id) })
    expect(metadata.title).toBe("New Verification Process")
    expect(metadata.description).toBe("We've updated verification.")
    expect(metadata.openGraph?.images).toEqual(["https://cdn.example.com/news-cover.jpg"])
    expect(metadata.twitter?.card).toBe("summary_large_image")
  })

  // No cover image means the images fields are omitted, not a broken/empty array
  it("omits image fields when there is no cover image", async () => {
    vi.mocked(getNewsById).mockResolvedValue({ ...publishedNews, coverImage: null })
    const metadata = await generateMetadata({ params: params(publishedNews.id) })
    expect(metadata.openGraph?.images).toBeUndefined()
    expect(metadata.twitter?.images).toBeUndefined()
  })

  // Drafts never leak metadata — falls back to the root layout's defaults
  it("returns empty metadata for draft news", async () => {
    vi.mocked(getNewsById).mockResolvedValue({ ...publishedNews, status: "draft" })
    const metadata = await generateMetadata({ params: params(publishedNews.id) })
    expect(metadata).toEqual({})
  })

  // Non-existent id returns empty metadata rather than throwing
  it("returns empty metadata for a non-existent id", async () => {
    vi.mocked(getNewsById).mockResolvedValue(null)
    const metadata = await generateMetadata({ params: params("does-not-exist") })
    expect(metadata).toEqual({})
  })
})

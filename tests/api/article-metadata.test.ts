import { describe, it, expect, vi, beforeEach } from "vitest"
import { connection } from "next/server"
import { getArticleById } from "@/features/articles/db/articles"
import { generateMetadata } from "@/app/articles/[id]/page"

vi.mock("next/server", () => ({
  connection: vi.fn(),
}))
vi.mock("@/features/articles/db/articles", () => ({
  getArticleById: vi.fn(),
}))

const params = (id: string) => Promise.resolve({ id })

const publishedArticle = {
  id: "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
  title: "Gemstone Identification",
  slug: "gemstone-identification",
  content: JSON.stringify([{ type: "paragraph", content: [{ type: "text", text: "How to verify a gemstone." }] }]),
  author: "Gem X Newsroom",
  category: "gemology",
  coverImage: "https://cdn.example.com/cover.jpg",
  isFeatured: false,
  status: "published",
  publishDate: new Date("2026-05-20"),
  createdAt: new Date("2026-05-18"),
  updatedAt: new Date("2026-05-20"),
}

describe("generateMetadata for /articles/[id]", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
  })

  // A published article with a cover image gets a full OG/Twitter card
  it("returns title, description, and image metadata for a published article", async () => {
    vi.mocked(getArticleById).mockResolvedValue(publishedArticle)
    const metadata = await generateMetadata({ params: params(publishedArticle.id) })
    expect(metadata.title).toBe("Gemstone Identification")
    expect(metadata.description).toBe("How to verify a gemstone.")
    expect(metadata.openGraph?.images).toEqual(["https://cdn.example.com/cover.jpg"])
    expect(metadata.twitter?.card).toBe("summary_large_image")
  })

  // No cover image means the images fields are omitted, not a broken/empty array
  it("omits image fields when there is no cover image", async () => {
    vi.mocked(getArticleById).mockResolvedValue({ ...publishedArticle, coverImage: null })
    const metadata = await generateMetadata({ params: params(publishedArticle.id) })
    expect(metadata.openGraph?.images).toBeUndefined()
    expect(metadata.twitter?.images).toBeUndefined()
  })

  // Drafts never leak metadata — falls back to the root layout's defaults
  it("returns empty metadata for a draft article", async () => {
    vi.mocked(getArticleById).mockResolvedValue({ ...publishedArticle, status: "draft" })
    const metadata = await generateMetadata({ params: params(publishedArticle.id) })
    expect(metadata).toEqual({})
  })

  // Non-existent id returns empty metadata rather than throwing
  it("returns empty metadata for a non-existent id", async () => {
    vi.mocked(getArticleById).mockResolvedValue(null)
    const metadata = await generateMetadata({ params: params("does-not-exist") })
    expect(metadata).toEqual({})
  })
})

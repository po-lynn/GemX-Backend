import { afterEach, describe, it, expect, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { ArticleForm } from "@/features/articles/components/ArticleForm"

afterEach(cleanup)

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="blocknote-stub" />,
}))
vi.mock("@/features/articles/actions/articles", () => ({
  createArticleAction: vi.fn(),
  updateArticleAction: vi.fn(),
}))
vi.mock("@/features/articles/hooks/useAutoSave", () => ({
  useAutoSave: () => ({ autoSaveState: "idle", lastAutoSaved: null }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const articleRow = {
  id: "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
  title: "Gemstone Identification",
  slug: "gemstone-identification",
  content: "[]",
  author: "Gem X Newsroom",
  category: "gemology",
  coverImage: null,
  isFeatured: false,
  status: "draft" as const,
  publishDate: null,
  createdAt: new Date("2026-07-01"),
  updatedAt: new Date("2026-07-01"),
}

describe("ArticleForm Share card", () => {
  // Create mode has no id yet — sharing is disabled with a "save first" reason
  it("disables sharing in create mode", () => {
    render(<ArticleForm mode="create" />)
    expect(screen.getByTitle("Save first to share")).toBeInTheDocument()
  })

  // Edit mode, still a draft — sharing is disabled with a "publish first" reason
  it("disables sharing for a draft in edit mode", () => {
    render(<ArticleForm mode="edit" article={articleRow} />)
    expect(screen.getByTitle("Publish first to share")).toBeInTheDocument()
  })

  // Edit mode, published — sharing is enabled and the link targets the public article URL
  it("enables sharing for a published article and builds the correct public URL", () => {
    render(<ArticleForm mode="edit" article={{ ...articleRow, status: "published" }} />)
    const fb = screen.getByRole("link", { name: /facebook/i })
    expect(fb.getAttribute("href")).toContain(encodeURIComponent(`/articles/${articleRow.id}`))
  })
})

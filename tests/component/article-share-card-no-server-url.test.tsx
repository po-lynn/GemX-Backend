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
vi.mock("@/data/env/client", () => ({ env: { NEXT_PUBLIC_SERVER_URL: undefined } }))

const publishedArticle = {
  id: "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
  title: "Gemstone Identification",
  slug: "gemstone-identification",
  content: "[]",
  author: "Gem X Newsroom",
  category: "gemology",
  coverImage: null,
  isFeatured: false,
  status: "published" as const,
  publishDate: null,
  createdAt: new Date("2026-07-01"),
  updatedAt: new Date("2026-07-01"),
}

describe("ArticleForm Share card without NEXT_PUBLIC_SERVER_URL", () => {
  // Even a published article can't build a real share URL without the base domain —
  // sharing is disabled with a distinct reason instead of constructing a broken link
  it("disables sharing with 'Sharing unavailable' when the env var is missing", () => {
    render(<ArticleForm mode="edit" article={publishedArticle} />)
    expect(screen.getByTitle("Sharing unavailable")).toBeInTheDocument()
  })
})

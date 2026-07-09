import { afterEach, describe, it, expect, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { NewsForm } from "@/features/news/components/NewsForm"

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
vi.mock("@/features/news/actions/news", () => ({
  createNewsAction: vi.fn(),
  updateNewsAction: vi.fn(),
}))
vi.mock("@/features/news/hooks/useAutoSave", () => ({
  useAutoSave: () => ({ autoSaveState: "idle", lastAutoSaved: null }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const newsRow = {
  id: "1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d",
  title: "New Verification Process",
  content: "[]",
  author: "Gem X Newsroom",
  category: "general",
  coverImage: null,
  isFeatured: false,
  status: "draft" as const,
  publish: null,
  createdAt: new Date("2026-07-01"),
  updatedAt: new Date("2026-07-01"),
}

describe("NewsForm Share card", () => {
  // Create mode has no id yet — sharing is disabled with a "save first" reason
  it("disables sharing in create mode", () => {
    render(<NewsForm mode="create" />)
    expect(screen.getByTitle("Save first to share")).toBeInTheDocument()
  })

  // Edit mode, still a draft — sharing is disabled with a "publish first" reason
  it("disables sharing for a draft in edit mode", () => {
    render(<NewsForm mode="edit" news={newsRow} />)
    expect(screen.getByTitle("Publish first to share")).toBeInTheDocument()
  })

  // Edit mode, published — sharing is enabled and the link targets the public news URL
  it("enables sharing for published news and builds the correct public URL", () => {
    render(<NewsForm mode="edit" news={{ ...newsRow, status: "published" }} />)
    const fb = screen.getByRole("link", { name: /facebook/i })
    expect(fb.getAttribute("href")).toContain(encodeURIComponent(`/news/${newsRow.id}`))
  })
})

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
vi.mock("@/data/env/client", () => ({ env: { NEXT_PUBLIC_SERVER_URL: undefined } }))

const publishedNews = {
  id: "1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d",
  title: "New Verification Process",
  content: "[]",
  author: "Gem X Newsroom",
  category: "general",
  coverImage: null,
  isFeatured: false,
  status: "published" as const,
  publish: null,
  createdAt: new Date("2026-07-01"),
  updatedAt: new Date("2026-07-01"),
}

describe("NewsForm Share card without NEXT_PUBLIC_SERVER_URL", () => {
  // Even published news can't build a real share URL without the base domain —
  // sharing is disabled with a distinct reason instead of constructing a broken link
  it("disables sharing with 'Sharing unavailable' when the env var is missing", () => {
    render(<NewsForm mode="edit" news={publishedNews} />)
    expect(screen.getByTitle("Sharing unavailable")).toBeInTheDocument()
  })
})

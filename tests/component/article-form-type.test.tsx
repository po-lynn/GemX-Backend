import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null }) },
}))

const createArticleAction = vi.fn()
const updateArticleAction = vi.fn()
vi.mock("@/features/articles/actions/articles", () => ({
  createArticleAction: (...args: unknown[]) => createArticleAction(...args),
  updateArticleAction: (...args: unknown[]) => updateArticleAction(...args),
}))

vi.mock("@/features/articles/hooks/useAutoSave", () => ({
  useAutoSave: () => ({ autoSaveState: "idle", lastAutoSaved: null }),
}))

vi.mock("@blocknote/react", () => ({
  useCreateBlockNote: () => ({ document: [] }),
}))
vi.mock("@blocknote/mantine", () => ({
  BlockNoteView: () => <div data-testid="editor" />,
}))
vi.mock("@mantine/core", () => ({
  MantineProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { ArticleForm } from "@/features/articles/components/ArticleForm"
import type { ArticleRow } from "@/features/articles/db/articles"

function baseArticle(overrides: Partial<ArticleRow> = {}): ArticleRow {
  return {
    id: "3f8a2b1c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    title: "Existing",
    slug: "existing",
    language: "English",
    titleEn: "Existing",
    titleMy: null,
    titleTh: null,
    titleKo: null,
    content: "[]",
    contentEn: "[]",
    contentMy: null,
    contentTh: null,
    contentKo: null,
    author: "Editor",
    type: "article",
    category: "general",
    coverImage: null,
    isFeatured: false,
    status: "draft",
    publishDate: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    ...overrides,
  }
}

describe("ArticleForm — Type dropdown", () => {
  beforeEach(() => {
    createArticleAction.mockReset()
    updateArticleAction.mockReset()
    createArticleAction.mockResolvedValue({ success: true, articleId: "new-id" })
    updateArticleAction.mockResolvedValue({ success: true, articleId: "3f8a2b1c-4d5e-4f60-8a7b-9c0d1e2f3a4b" })
  })

  // Validates create form exposes Type with News and Articles options (default Articles).
  it("renders Type select defaulting to Articles on create", () => {
    render(<ArticleForm mode="create" />)
    const typeSelect = screen.getByLabelText("Type") as HTMLSelectElement
    expect(typeSelect.value).toBe("article")
    expect(screen.getByRole("option", { name: "News" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Articles" })).toBeInTheDocument()
  })

  // Validates create submits the selected Type in FormData.
  it("submits type=news when News is selected on create", async () => {
    render(<ArticleForm mode="create" />)
    fireEvent.change(screen.getByPlaceholderText("Article title…"), {
      target: { value: "Flash update" },
    })
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "news" } })
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }))

    await waitFor(() => expect(createArticleAction).toHaveBeenCalled())
    const formData = createArticleAction.mock.calls[0][0] as FormData
    expect(formData.get("type")).toBe("news")
  })

  // Validates edit form loads existing type and can update it.
  it("loads existing type on edit and submits the changed value", async () => {
    render(<ArticleForm mode="edit" article={baseArticle({ type: "news" })} />)
    const typeSelect = screen.getByLabelText("Type") as HTMLSelectElement
    expect(typeSelect.value).toBe("news")

    fireEvent.change(typeSelect, { target: { value: "article" } })
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }))

    await waitFor(() => expect(updateArticleAction).toHaveBeenCalled())
    const formData = updateArticleAction.mock.calls[0][0] as FormData
    expect(formData.get("type")).toBe("article")
  })
})

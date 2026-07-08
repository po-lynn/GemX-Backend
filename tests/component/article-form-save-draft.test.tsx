// tests/component/article-form-save-draft.test.tsx
//
// Reproduces the reported bug: on /admin/articles/new, typing into the BlockNote
// editor then clicking "Save draft" does not persist the typed content. This test
// keeps ArticleForm.tsx and BlockNoteEditor.tsx REAL (the two files responsible for
// wiring editor content into the submitted FormData) and mocks only the BlockNote
// library internals that cannot run under jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null }) },
}));

const createArticleAction = vi.fn();
const updateArticleAction = vi.fn();
vi.mock("@/features/articles/actions/articles", () => ({
  createArticleAction: (...args: unknown[]) => createArticleAction(...args),
  updateArticleAction: (...args: unknown[]) => updateArticleAction(...args),
}));

vi.mock("@/features/articles/hooks/useAutoSave", () => ({
  useAutoSave: () => ({ autoSaveState: "idle", lastAutoSaved: null }),
}));

// A stable, mutable stand-in for the real BlockNote editor instance.
// `useCreateBlockNote` in the real library returns the SAME instance across
// re-renders; this mock preserves that so `handleChange`'s effect wiring in
// BlockNoteEditor.tsx behaves identically to production.
const fakeEditor: { document: unknown[] } = { document: [] };
vi.mock("@blocknote/react", () => ({
  useCreateBlockNote: () => fakeEditor,
}));
vi.mock("@blocknote/mantine", () => ({
  BlockNoteView: ({ onChange }: { onChange?: () => void }) => (
    <button
      type="button"
      data-testid="simulate-typing"
      onClick={() => {
        fakeEditor.document = [
          { id: "1", type: "paragraph", content: [{ type: "text", text: "Hello world", styles: {} }] },
        ];
        onChange?.();
      }}
    >
      simulate typing
    </button>
  ),
}));
vi.mock("@mantine/core", () => ({
  MantineProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { ArticleForm } from "@/features/articles/components/ArticleForm";

describe("ArticleForm — new article save draft", () => {
  beforeEach(() => {
    createArticleAction.mockReset();
    updateArticleAction.mockReset();
    createArticleAction.mockResolvedValue({ success: true, articleId: "new-id" });
    fakeEditor.document = [];
  });

  it("submits the typed BlockNote content when Save draft is clicked", async () => {
    render(<ArticleForm mode="create" />);

    fireEvent.change(screen.getByPlaceholderText("Article title…"), {
      target: { value: "My test article" },
    });

    const editorStub = await screen.findByTestId("simulate-typing");
    fireEvent.click(editorStub); // simulates typing into the real BlockNote editor

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(createArticleAction).toHaveBeenCalledTimes(1));
    const fd: FormData = createArticleAction.mock.calls[0][0];
    expect(fd.get("title")).toBe("My test article");
    expect(fd.get("content")).toContain("Hello world");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/articles/db/articles", () => ({
  updateArticleInDb: vi.fn(),
  getArticleById: vi.fn(),
  createArticleInDb: vi.fn(),
  deleteArticleInDb: vi.fn(),
  getArticlesPaginatedFromDb: vi.fn(),
}));

vi.mock("@/lib/action-guard", () => ({
  requireActionRole: vi.fn(),
}));

vi.mock("@/features/notifications/services/global-push", () => ({
  sendArticlePublishedNotification: vi.fn(),
}));

import { autoSaveArticleAction } from "@/features/articles/actions/articles";
import { getArticleById, updateArticleInDb } from "@/features/articles/db/articles";
import { requireActionRole } from "@/lib/action-guard";

const mockUpdateArticleInDb = vi.mocked(updateArticleInDb);
const mockGetArticleById = vi.mocked(getArticleById);
const mockRequireActionRole = vi.mocked(requireActionRole);

const VALID_ID = "a9737f10-b7e1-4dd0-8f20-a421bfa8cd1f";

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("articleId", VALID_ID);
  fd.set("title", "Test Article");
  fd.set("author", "Gem X");
  fd.set("content", "[]");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("autoSaveArticleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireActionRole.mockResolvedValue({ user: { id: "admin-1" } } as never);
    mockUpdateArticleInDb.mockResolvedValue({ justPublished: false });
    mockGetArticleById.mockResolvedValue({
      id: VALID_ID,
      title: "Test Article",
      slug: "test-article",
      language: "English",
      titleEn: "Test Article",
      titleMy: null,
      titleTh: null,
      titleKo: null,
      content: "[]",
      contentEn: "[]",
      contentMy: null,
      contentTh: null,
      contentKo: null,
      author: "Gem X",
      category: "general",
      coverImage: null,
      isFeatured: false,
      status: "draft",
      publishDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("returns error when articleId is not a valid uuid", async () => {
    // articleId validation must catch non-uuid values
    const result = await autoSaveArticleAction(makeFormData({ articleId: "not-a-uuid" }));
    expect(result).toEqual({ error: expect.any(String) });
    expect(mockUpdateArticleInDb).not.toHaveBeenCalled();
  });

  it("returns error when title is empty", async () => {
    // empty title must fail validation before hitting the db
    const result = await autoSaveArticleAction(makeFormData({ title: "" }));
    expect(result).toEqual({ error: expect.any(String) });
    expect(mockUpdateArticleInDb).not.toHaveBeenCalled();
  });

  it("returns error when user is unauthorized", async () => {
    // requireActionRole returns null when session is missing or role is wrong
    mockRequireActionRole.mockResolvedValue(null as never);
    const result = await autoSaveArticleAction(makeFormData());
    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockUpdateArticleInDb).not.toHaveBeenCalled();
  });

  it("calls updateArticleInDb with title, author, content when editLanguage omitted", async () => {
    // legacy autosave path without locale switch
    await autoSaveArticleAction(makeFormData());
    expect(mockUpdateArticleInDb).toHaveBeenCalledWith(VALID_ID, {
      title: "Test Article",
      author: "Gem X",
      content: "[]",
      slug: "test-article",
    });
  });

  it("writes localized columns when editLanguage is set", async () => {
    // Thai edit should update titleTh/contentTh only (source is English)
    await autoSaveArticleAction(
      makeFormData({ editLanguage: "Thai", title: "หัวข้อ", content: '[{"t":"th"}]' }),
    );
    expect(mockUpdateArticleInDb).toHaveBeenCalledWith(VALID_ID, {
      titleTh: "หัวข้อ",
      contentTh: '[{"t":"th"}]',
      author: "Gem X",
    });
  });

  it("also updates canonical title/content when editing the source language", async () => {
    await autoSaveArticleAction(
      makeFormData({ editLanguage: "English", title: "Updated EN", content: "[1]" }),
    );
    expect(mockUpdateArticleInDb).toHaveBeenCalledWith(VALID_ID, {
      titleEn: "Updated EN",
      contentEn: "[1]",
      title: "Updated EN",
      content: "[1]",
      author: "Gem X",
      slug: "updated-en",
    });
  });

  it("returns { success: true } on successful save", async () => {
    const result = await autoSaveArticleAction(makeFormData());
    expect(result).toEqual({ success: true });
  });
});

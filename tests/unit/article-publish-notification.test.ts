import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  after: vi.fn((cb: () => unknown) => cb()),
}));

vi.mock("@/features/articles/db/articles", () => ({
  updateArticleInDb: vi.fn(),
  createArticleInDb: vi.fn(),
  deleteArticleInDb: vi.fn(),
  getArticleById: vi.fn(),
}));

vi.mock("@/lib/action-guard", () => ({
  requireActionRole: vi.fn(),
}));

vi.mock("@/features/notifications/services/global-push", () => ({
  sendArticlePublishedNotification: vi.fn(),
}));

import { updateArticleAction } from "@/features/articles/actions/articles";
import { updateArticleInDb, getArticleById } from "@/features/articles/db/articles";
import { requireActionRole } from "@/lib/action-guard";
import { sendArticlePublishedNotification } from "@/features/notifications/services/global-push";

const mockUpdateArticleInDb = vi.mocked(updateArticleInDb);
const mockGetArticleById = vi.mocked(getArticleById);
const mockRequireActionRole = vi.mocked(requireActionRole);
const mockSendNotification = vi.mocked(sendArticlePublishedNotification);

const VALID_ID = "659fba89-4178-414b-9cc0-a9b3a0021a64";

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("articleId", VALID_ID);
  fd.set("title", "Test Article");
  fd.set("status", "published");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("updateArticleAction notification guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireActionRole.mockResolvedValue({ user: { id: "admin-1" } } as never);
    mockSendNotification.mockResolvedValue(undefined as never);
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
      author: "",
      category: "general",
      coverImage: null,
      isFeatured: false,
      status: "draft",
      publishDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  // Reproduces the "Publish now" click: db layer reports a genuine draft -> published
  // transition, so exactly one notification must be sent.
  it("sends a notification when the db reports a fresh publish transition", async () => {
    mockUpdateArticleInDb.mockResolvedValue({ justPublished: true, title: "Test Article" });
    const result = await updateArticleAction(makeFormData());
    expect(result).toEqual({ success: true, articleId: VALID_ID });
    expect(mockSendNotification).toHaveBeenCalledTimes(1);
    expect(mockSendNotification).toHaveBeenCalledWith({
      articleId: VALID_ID,
      title: "Test Article",
    });
  });

  // Reproduces re-opening /admin/articles/[id]/edit and saving an already-published
  // article again: the db layer reports no transition, so no duplicate push should fire.
  it("does not send a notification when the article was already published", async () => {
    mockUpdateArticleInDb.mockResolvedValue({ justPublished: false });
    await updateArticleAction(makeFormData());
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  // Saving a draft (no status change to "published") must never notify.
  it("does not send a notification when status is not being set to published", async () => {
    mockUpdateArticleInDb.mockResolvedValue({ justPublished: false });
    await updateArticleAction(makeFormData({ status: "draft" }));
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  // Guards against relying on a stale/undefined title from the caller — the notification
  // must use the title the db layer reports as current.
  it("falls back to a default title only if the db layer omits one", async () => {
    mockUpdateArticleInDb.mockResolvedValue({ justPublished: true, title: undefined });
    await updateArticleAction(makeFormData());
    expect(mockSendNotification).toHaveBeenCalledWith({
      articleId: VALID_ID,
      title: "New article",
    });
  });

  it("returns error when user is unauthorized", async () => {
    mockRequireActionRole.mockResolvedValue(null as never);
    const result = await updateArticleAction(makeFormData());
    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockUpdateArticleInDb).not.toHaveBeenCalled();
    expect(mockSendNotification).not.toHaveBeenCalled();
  });
});

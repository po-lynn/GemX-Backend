import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/news/db/news", () => ({
  updateNewsInDb: vi.fn(),
  getNewsById: vi.fn(),
  createNewsInDb: vi.fn(),
  deleteNewsInDb: vi.fn(),
  getNewsPaginatedFromDb: vi.fn(),
  getNewsStatusCountsFromDb: vi.fn(),
}));

vi.mock("@/lib/action-guard", () => ({
  requireActionRole: vi.fn(),
}));

vi.mock("@/features/notifications/services/global-push", () => ({
  sendNewsPublishedNotification: vi.fn(),
}));

import { autoSaveNewsAction } from "@/features/news/actions/news";
import { updateNewsInDb } from "@/features/news/db/news";
import { requireActionRole } from "@/lib/action-guard";

const mockUpdateNewsInDb = vi.mocked(updateNewsInDb);
const mockRequireActionRole = vi.mocked(requireActionRole);

const VALID_ID = "a9737f10-b7e1-4dd0-8f20-a421bfa8cd1f";

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("newsId", VALID_ID);
  fd.set("title", "Test Article");
  fd.set("content", "[]");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("autoSaveNewsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireActionRole.mockResolvedValue({ user: { id: "admin-1" } } as never);
    mockUpdateNewsInDb.mockResolvedValue(true);
  });

  it("returns error when newsId is not a valid uuid", async () => {
    // newsId validation must catch non-uuid values
    const result = await autoSaveNewsAction(makeFormData({ newsId: "not-a-uuid" }));
    expect(result).toEqual({ error: expect.any(String) });
    expect(mockUpdateNewsInDb).not.toHaveBeenCalled();
  });

  it("returns error when title is empty", async () => {
    // empty title must fail validation before hitting the db
    const result = await autoSaveNewsAction(makeFormData({ title: "" }));
    expect(result).toEqual({ error: expect.any(String) });
    expect(mockUpdateNewsInDb).not.toHaveBeenCalled();
  });

  it("returns error when user is unauthorized", async () => {
    // requireActionRole returns null when session is missing or role is wrong
    mockRequireActionRole.mockResolvedValue(null as never);
    const result = await autoSaveNewsAction(makeFormData());
    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockUpdateNewsInDb).not.toHaveBeenCalled();
  });

  it("calls updateNewsInDb with only title and content", async () => {
    // auto-save must never write status or publish
    await autoSaveNewsAction(makeFormData());
    expect(mockUpdateNewsInDb).toHaveBeenCalledWith(VALID_ID, {
      title: "Test Article",
      content: "[]",
    });
  });

  it("ignores status and publish fields even when present in FormData", async () => {
    // extra fields must be stripped, not forwarded to the db
    const fd = makeFormData();
    fd.set("status", "published");
    fd.set("publish", "2026-07-01");
    await autoSaveNewsAction(fd);
    const callArgs = mockUpdateNewsInDb.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty("status");
    expect(callArgs).not.toHaveProperty("publish");
  });

  it("returns { success: true } on successful save", async () => {
    const result = await autoSaveNewsAction(makeFormData());
    expect(result).toEqual({ success: true });
  });
});

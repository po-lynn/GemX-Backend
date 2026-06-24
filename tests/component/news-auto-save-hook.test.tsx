// tests/component/news-auto-save-hook.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/features/news/actions/news", () => ({
  autoSaveNewsAction: vi.fn(),
  createNewsAction: vi.fn(),
  updateNewsAction: vi.fn(),
  deleteNewsAction: vi.fn(),
}));

import { useAutoSave } from "@/features/news/hooks/useAutoSave";
import { autoSaveNewsAction } from "@/features/news/actions/news";

const mockAction = vi.mocked(autoSaveNewsAction);

const BASE = {
  id: "a9737f10-b7e1-4dd0-8f20-a421bfa8cd1f",
  title: "Initial title",
  content: "[]",
  enabled: true,
  debounceMs: 500,
} as const;

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockAction.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("starts in idle state with no lastAutoSaved", () => {
    // initial render must not trigger any save
    const { result } = renderHook(() => useAutoSave(BASE));
    expect(result.current.autoSaveState).toBe("idle");
    expect(result.current.lastAutoSaved).toBeNull();
    expect(mockAction).not.toHaveBeenCalled();
  });

  it("transitions to pending when title changes", () => {
    // any change should immediately show pending (debounce started)
    const { result, rerender } = renderHook(
      ({ title }: { title: string }) => useAutoSave({ ...BASE, title }),
      { initialProps: { title: "Initial title" } }
    );
    rerender({ title: "Updated title" });
    expect(result.current.autoSaveState).toBe("pending");
  });

  it("transitions to pending when content changes", () => {
    const { result, rerender } = renderHook(
      ({ content }: { content: string }) => useAutoSave({ ...BASE, content }),
      { initialProps: { content: "[]" } }
    );
    rerender({ content: '[{"type":"paragraph"}]' });
    expect(result.current.autoSaveState).toBe("pending");
  });

  it("does not call the action before debounce delay elapses", () => {
    // action must not fire mid-typing
    const { rerender } = renderHook(
      ({ title }: { title: string }) => useAutoSave({ ...BASE, title }),
      { initialProps: { title: "Initial title" } }
    );
    rerender({ title: "Updated" });
    expect(mockAction).not.toHaveBeenCalled();
  });

  it("calls autoSaveNewsAction with correct FormData after debounce delay", async () => {
    const { rerender } = renderHook(
      ({ title }: { title: string }) => useAutoSave({ ...BASE, title }),
      { initialProps: { title: "Initial title" } }
    );
    rerender({ title: "Updated title" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BASE.debounceMs);
    });
    expect(mockAction).toHaveBeenCalledTimes(1);
    const fd: FormData = mockAction.mock.calls[0][0];
    expect(fd.get("newsId")).toBe(BASE.id);
    expect(fd.get("title")).toBe("Updated title");
    expect(fd.get("content")).toBe("[]");
  });

  it("sets state to saved and records lastAutoSaved on success", async () => {
    const { result, rerender } = renderHook(
      ({ title }: { title: string }) => useAutoSave({ ...BASE, title }),
      { initialProps: { title: "Initial title" } }
    );
    rerender({ title: "Updated title" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BASE.debounceMs);
    });
    expect(result.current.autoSaveState).toBe("saved");
    expect(result.current.lastAutoSaved).toBeInstanceOf(Date);
  });

  it("sets state to error when action returns error", async () => {
    // silent failure — state is error, no throw
    mockAction.mockResolvedValue({ error: "Unauthorized" });
    const { result, rerender } = renderHook(
      ({ title }: { title: string }) => useAutoSave({ ...BASE, title }),
      { initialProps: { title: "Initial title" } }
    );
    rerender({ title: "Updated title" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BASE.debounceMs);
    });
    expect(result.current.autoSaveState).toBe("error");
    expect(result.current.lastAutoSaved).toBeNull();
  });

  it("skips auto-save when title is empty string", async () => {
    // empty title would fail server validation; skip client-side
    const { rerender } = renderHook(
      ({ title }: { title: string }) => useAutoSave({ ...BASE, title }),
      { initialProps: { title: "Initial title" } }
    );
    rerender({ title: "" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BASE.debounceMs);
    });
    expect(mockAction).not.toHaveBeenCalled();
  });

  it("is a no-op when enabled is false", async () => {
    // create mode passes enabled=false; hook must never fire
    const { rerender } = renderHook(
      ({ title }: { title: string }) => useAutoSave({ ...BASE, title, enabled: false }),
      { initialProps: { title: "Initial title" } }
    );
    rerender({ title: "Updated title" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BASE.debounceMs);
    });
    expect(mockAction).not.toHaveBeenCalled();
  });

  it("resets debounce on rapid changes (only one save after last change)", async () => {
    // typing rapidly should produce exactly one save after the final keystroke
    const { rerender } = renderHook(
      ({ title }: { title: string }) => useAutoSave({ ...BASE, title }),
      { initialProps: { title: "Initial title" } }
    );
    rerender({ title: "U" });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    rerender({ title: "Up" });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    rerender({ title: "Updated" });
    // Only 200 ms since last change — must not have fired yet
    expect(mockAction).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(BASE.debounceMs); });
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it("does not update state after unmount (no setState on unmounted component)", async () => {
    // timer must be cancelled on unmount
    const { rerender, unmount } = renderHook(
      ({ title }: { title: string }) => useAutoSave({ ...BASE, title }),
      { initialProps: { title: "Initial title" } }
    );
    rerender({ title: "Updated title" });
    unmount();
    // Advancing past debounce after unmount must not throw React warnings
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BASE.debounceMs);
    });
    expect(mockAction).not.toHaveBeenCalled();
  });
});

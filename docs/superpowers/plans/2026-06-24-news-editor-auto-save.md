# News Editor Auto-Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add debounced auto-save (3 s after typing stops) to the news editor edit page, saving title and content without touching status or publish date.

**Architecture:** A dedicated `autoSaveNewsAction` server action handles title+content-only DB writes. A `useAutoSave` client hook manages the debounce timer and state machine. `BlockNoteEditor` gains an `onContentChange` callback to surface content into React state, which feeds the hook. `NewsForm` wires everything together and updates the savebar label.

**Tech Stack:** Next.js 15 server actions, React hooks, Vitest, `@testing-library/react` v16, `zod`

## Global Constraints

- Auto-save is **edit mode only** — `enabled` must be `false` in create mode.
- Auto-save **never touches** `status` or `publish` — dedicated action only accepts `newsId`, `title`, `content`.
- Debounce delay: **3000 ms** (default; overridable via `debounceMs` for tests).
- Skip auto-save when `title.trim()` is empty — title is a required field.
- Auto-save failure is **silent** — show `"Couldn't auto-save"` in savebar; no blocking modal.
- Action tests: `tests/unit/` (node env). Hook tests: `tests/component/` (jsdom env).

---

## File Map

| Action | File |
|--------|------|
| Modify | `features/news/actions/news.ts` — add `autoSaveNewsAction` export + `import { z } from "zod"` |
| Modify | `features/news/components/BlockNoteEditor.tsx` — add `onContentChange` prop |
| Create | `features/news/hooks/useAutoSave.ts` |
| Modify | `features/news/components/NewsForm.tsx` — track content state, wire hook, update savebar |
| Create | `tests/unit/news-auto-save-action.test.ts` |
| Create | `tests/component/news-auto-save-hook.test.tsx` |

---

## Task 1: `autoSaveNewsAction` server action (TDD)

**Files:**
- Modify: `features/news/actions/news.ts`
- Create: `tests/unit/news-auto-save-action.test.ts`

**Interfaces:**
- Produces: `autoSaveNewsAction(formData: FormData): Promise<{ success: true } | { error: string }>`
- Accepts FormData fields: `newsId` (uuid), `title` (1–500), `content` (0–500 000 chars)
- Never reads or writes `status` or `publish`

---

- [ ] **Step 1: Create the test file**

```typescript
// tests/unit/news-auto-save-action.test.ts
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
    mockUpdateNewsInDb.mockResolvedValue(undefined);
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
```

- [ ] **Step 2: Run the tests — confirm they all fail**

```bash
npx vitest run tests/unit/news-auto-save-action.test.ts
```

Expected: all tests fail with "autoSaveNewsAction is not a function" or similar (the export does not exist yet).

- [ ] **Step 3: Implement `autoSaveNewsAction` in the actions file**

Open `features/news/actions/news.ts`. Add `import { z } from "zod"` as the first import, then append the new export at the bottom of the file.

```typescript
// Add at top of features/news/actions/news.ts (after "use server"):
import { z } from "zod";
```

```typescript
// Append at bottom of features/news/actions/news.ts:
export async function autoSaveNewsAction(formData: FormData) {
  const parsed = z
    .object({
      newsId: z.string().uuid(),
      title: z.string().min(1, "Title is required").max(500),
      content: z.string().max(500_000),
    })
    .safeParse({
      newsId: formData.get("newsId"),
      title: formData.get("title"),
      content: formData.get("content") ?? "[]",
    });
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) };
  }
  const session = await requireActionRole(canAdminManageNews);
  if (!session) {
    return { error: "Unauthorized" };
  }
  await updateNewsInDb(parsed.data.newsId, {
    title: parsed.data.title,
    content: parsed.data.content,
  });
  return { success: true };
}
```

- [ ] **Step 4: Run the tests — confirm they all pass**

```bash
npx vitest run tests/unit/news-auto-save-action.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add features/news/actions/news.ts tests/unit/news-auto-save-action.test.ts
git commit -m "feat: add autoSaveNewsAction for title+content-only news updates"
```

---

## Task 2: `BlockNoteEditor` `onContentChange` prop + `NewsForm` content state

**Files:**
- Modify: `features/news/components/BlockNoteEditor.tsx`
- Modify: `features/news/components/NewsForm.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces:
  - `BlockNoteEditor` accepts `onContentChange?: (json: string) => void`
  - `NewsForm` tracks `content: string` state, updates via `onContentChange`, also sets `dirty = true` on content change

*Note: no automated test for `onContentChange` — BlockNote does not render in jsdom. Correct wiring is verified by the hook test in Task 3 and manual inspection.*

---

- [ ] **Step 1: Add `onContentChange` prop to `BlockNoteEditor`**

In `features/news/components/BlockNoteEditor.tsx`, update the `Props` type and `handleChange` callback:

```typescript
// Replace the Props type (currently lines 23–26):
type Props = {
  name: string;
  initialContent?: string | null;
  onContentChange?: (json: string) => void;
};

// Replace the function signature (currently line 28):
export function BlockNoteEditor({ name, initialContent, onContentChange }: Props) {
```

```typescript
// Replace handleChange (currently lines 78–82):
const handleChange = useCallback(() => {
  if (!editor.document || !hiddenInputRef.current) return;
  const json = JSON.stringify(editor.document);
  hiddenInputRef.current.value = json;
  onContentChange?.(json);
}, [editor, onContentChange]);
```

- [ ] **Step 2: Add `content` state and `onContentChange` wiring in `NewsForm`**

In `features/news/components/NewsForm.tsx`:

Add `content` state after the existing `dirty` state (currently line 40):

```typescript
// After: const [dirty, setDirty] = useState(false);
const [content, setContent] = useState(news?.content ?? "[]");
```

Update the `BlockNoteEditor` call (currently line 161) to pass the callback:

```typescript
// Replace:
<BlockNoteEditor name="content" initialContent={news?.content} />

// With:
<BlockNoteEditor
  name="content"
  initialContent={news?.content}
  onContentChange={(json) => {
    setContent(json);
    setDirty(true);
  }}
/>
```

- [ ] **Step 3: Run the full lint check to confirm no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add features/news/components/BlockNoteEditor.tsx features/news/components/NewsForm.tsx
git commit -m "feat: add onContentChange callback to BlockNoteEditor; track content state in NewsForm"
```

---

## Task 3: `useAutoSave` hook (TDD)

**Files:**
- Create: `features/news/hooks/useAutoSave.ts`
- Create: `tests/component/news-auto-save-hook.test.tsx`

**Interfaces:**
- Consumes: `autoSaveNewsAction` from `@/features/news/actions/news`
- Produces:
  ```typescript
  export type AutoSaveState = "idle" | "pending" | "saving" | "saved" | "error";
  
  export function useAutoSave(options: {
    id: string;
    title: string;
    content: string;
    enabled: boolean;
    debounceMs?: number;   // default 3000
  }): { autoSaveState: AutoSaveState; lastAutoSaved: Date | null }
  ```

---

- [ ] **Step 1: Create the hook test file**

```typescript
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
```

- [ ] **Step 2: Run the tests — confirm they all fail**

```bash
npx vitest run tests/component/news-auto-save-hook.test.tsx
```

Expected: all tests fail with "Cannot find module '@/features/news/hooks/useAutoSave'".

- [ ] **Step 3: Create the hook implementation**

```typescript
// features/news/hooks/useAutoSave.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { autoSaveNewsAction } from "@/features/news/actions/news";

export type AutoSaveState = "idle" | "pending" | "saving" | "saved" | "error";

type Options = {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  debounceMs?: number;
};

type Return = {
  autoSaveState: AutoSaveState;
  lastAutoSaved: Date | null;
};

export function useAutoSave({
  id,
  title,
  content,
  enabled,
  debounceMs = 3000,
}: Options): Return {
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("idle");
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!enabled) return;

    setAutoSaveState("pending");

    const timer = setTimeout(() => {
      if (!title.trim()) return;

      setAutoSaveState("saving");

      const formData = new FormData();
      formData.set("newsId", id);
      formData.set("title", title);
      formData.set("content", content);

      autoSaveNewsAction(formData).then((result) => {
        if (result?.error) {
          setAutoSaveState("error");
        } else {
          setAutoSaveState("saved");
          setLastAutoSaved(new Date());
        }
      });
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [id, title, content, enabled, debounceMs]);

  return { autoSaveState, lastAutoSaved };
}
```

- [ ] **Step 4: Run the tests — confirm they all pass**

```bash
npx vitest run tests/component/news-auto-save-hook.test.tsx
```

Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add features/news/hooks/useAutoSave.ts tests/component/news-auto-save-hook.test.tsx
git commit -m "feat: add useAutoSave hook with debounce, state machine, and full test coverage"
```

---

## Task 4: Wire `useAutoSave` into `NewsForm` + update savebar

**Files:**
- Modify: `features/news/components/NewsForm.tsx`

**Interfaces:**
- Consumes: `useAutoSave` from `@/features/news/hooks/useAutoSave` (Task 3)
- Consumes: `content` state and `setContent` added in Task 2

*No automated test for the savebar UI — verified by manual inspection in the running app.*

---

- [ ] **Step 1: Add imports to `NewsForm`**

In `features/news/components/NewsForm.tsx`, update line 3:

```typescript
// Replace:
import { useState, useRef } from "react";

// With:
import { useState, useRef, useEffect } from "react";
```

Add the hook import after the existing imports:

```typescript
import { useAutoSave } from "@/features/news/hooks/useAutoSave";
```

- [ ] **Step 2: Wire the hook and add the useEffect to clear dirty on auto-save**

In `NewsForm`, add the hook call after the `error` state declaration (after line 42):

```typescript
// Add after: const [error, setError] = useState<string | null>(null);
const { autoSaveState, lastAutoSaved } = useAutoSave({
  id: news?.id ?? "",
  title,
  content,
  enabled: isEdit,
});

useEffect(() => {
  if (autoSaveState === "saved") setDirty(false);
}, [autoSaveState]);
```

- [ ] **Step 3: Replace the savebar status span**

In `NewsForm`, replace the savebar status span (currently lines 87–90):

```typescript
// Replace:
<span className={`n-savebar-status${dirty ? " dirty" : isEdit ? " saved" : ""}`}>
  <span className="n-savebar-status-dot" />
  {dirty ? "Unsaved changes" : isEdit ? `Saved · ${updatedLabel}` : "New article"}
</span>

// With:
<span className={`n-savebar-status${getSavebarStatusClass({ autoSaveState, dirty, isEdit })}`}>
  <span className="n-savebar-status-dot" />
  {getSavebarLabel({ autoSaveState, lastAutoSaved, dirty, isEdit, updatedLabel })}
</span>
```

Add the two helper functions just above the `NewsForm` function definition (before line 33):

```typescript
function getSavebarStatusClass({
  autoSaveState,
  dirty,
  isEdit,
}: {
  autoSaveState: string;
  dirty: boolean;
  isEdit: boolean;
}): string {
  if (autoSaveState === "pending" || autoSaveState === "saving") return " dirty";
  if (autoSaveState === "saved") return " saved";
  if (autoSaveState === "error") return " dirty";
  return dirty ? " dirty" : isEdit ? " saved" : "";
}

function getSavebarLabel({
  autoSaveState,
  lastAutoSaved,
  dirty,
  isEdit,
  updatedLabel,
}: {
  autoSaveState: string;
  lastAutoSaved: Date | null;
  dirty: boolean;
  isEdit: boolean;
  updatedLabel: string | null;
}): string {
  if (autoSaveState === "pending") return "Saving in a moment…";
  if (autoSaveState === "saving") return "Saving…";
  if (autoSaveState === "saved" && lastAutoSaved) {
    const time = lastAutoSaved.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `Auto-saved · ${time}`;
  }
  if (autoSaveState === "error") return "Couldn’t auto-save";
  if (dirty) return "Unsaved changes";
  if (isEdit) return `Saved · ${updatedLabel}`;
  return "New article";
}
```

- [ ] **Step 4: Run the full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: all tests pass (no regressions from the `NewsForm` changes).

- [ ] **Step 5: Run the TypeScript compiler**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manually verify in the running app**

Start the dev server:
```bash
npm run dev
```

Open `http://localhost:3000/admin/news/<any-existing-id>/edit` and confirm:

1. Edit the title — savebar shows "Saving in a moment…" immediately, then "Saving…", then "Auto-saved · {time}" after ~3 s.
2. Edit the body (BlockNote content) — same sequence as above.
3. Rapid typing — debounce resets; only one save fires after you stop.
4. Clear the title — savebar goes to "Saving in a moment…" then stays pending (no actual save fires because title is empty).
5. Manual "Save draft" button still works and clears dirty.
6. "Publish now" still redirects to `/admin/news`.
7. Open an article in create mode (`/admin/news/new`) — no auto-save fires (hook is disabled).

- [ ] **Step 7: Commit**

```bash
git add features/news/components/NewsForm.tsx
git commit -m "feat: wire useAutoSave into NewsForm; update savebar with auto-save state"
```

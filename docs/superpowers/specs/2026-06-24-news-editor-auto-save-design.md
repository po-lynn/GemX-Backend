# News Editor Auto-Save — Design Spec

**Date:** 2026-06-24  
**Scope:** Edit mode only (existing articles). Debounced on change. Preserves current status.

---

## Problem

The news editor requires a manual "Save draft" click to persist changes. Content edits (via BlockNote) don't even set the dirty flag today — only title and status changes do. Users risk losing work.

---

## Approach

**Approach B — `useAutoSave` hook + `onContentChange` prop.**

Auto-save fires 3 seconds after the user stops typing (debounced), saving only `title` and `content`. A dedicated server action is used to avoid accidentally clearing the `publish` date or changing `status`.

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `features/news/hooks/useAutoSave.ts` | Debounce timer, calls `autoSaveNewsAction`, returns state |
| (addition to) `features/news/actions/news.ts` | `autoSaveNewsAction` — lean action, title+content only |

### Modified files

| File | Change |
|------|--------|
| `features/news/components/BlockNoteEditor.tsx` | Add `onContentChange?: (json: string) => void` prop |
| `features/news/components/NewsForm.tsx` | Track content state, wire hook, update savebar |

---

## `autoSaveNewsAction`

Added to `features/news/actions/news.ts`.

**Accepts:** `newsId` (uuid), `title` (1–500 chars), `content` (0–500k chars)  
**Does NOT accept:** `status`, `publish` — these are intentionally excluded to avoid overwriting them.  
**Auth:** `requireActionRole(canAdminManageNews)` — same guard as other news actions.  
**DB:** calls `updateNewsInDb(newsId, { title, content })` — partial update.  
**Returns:** `{ success: true }` or `{ error: string }`

Validation uses an inline `z.object(...)` (not reusing `newsUpdateSchema`) because `newsUpdateSchema` makes all fields optional and includes `status`/`publish`, which must be excluded here.

---

## `useAutoSave` hook

```typescript
type AutoSaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

type Options = {
  id: string;
  title: string;
  content: string;
  enabled: boolean;   // false in create mode — hook is a no-op
  debounceMs?: number; // default 3000
};

type Return = {
  autoSaveState: AutoSaveState;
  lastAutoSaved: Date | null;
};
```

**State machine:**

```
idle ──(change)──► pending ──(3s elapsed)──► saving ──(success)──► saved
                      ▲                                 │
                      └─────────(change)────────────────┘
                                             (error)──► error ──(change)──► pending
```

**Behaviour:**
- On mount: state is `idle`, `lastAutoSaved` is `null`.
- On any change to `title` or `content`: cancel existing timer, set state to `pending`, start 3s timer.
- On timer fire: if `title.trim()` is empty, skip (title is required). Otherwise set state to `saving` and call `autoSaveNewsAction`.
- On success: set state to `saved`, update `lastAutoSaved` to `new Date()`.
- On error: set state to `error`. Silent — no blocking UI error (manual save still available).
- On unmount: cancel pending timer to avoid state updates on unmounted component.

---

## `BlockNoteEditor` change

Add optional prop:

```typescript
type Props = {
  name: string;
  initialContent?: string | null;
  onContentChange?: (json: string) => void;
};
```

In the existing `handleChange` callback, after updating `hiddenInputRef.current.value`, call `onContentChange(json)` if provided. No other changes.

---

## `NewsForm` changes

**Content state:**

```typescript
const [content, setContent] = useState(news?.content ?? "[]");
```

`BlockNoteEditor` receives `onContentChange={(json) => { setContent(json); setDirty(true); }}`.

This also fixes the existing gap: content edits previously did not set `dirty = true`.

**Hook wiring:**

```typescript
const { autoSaveState, lastAutoSaved } = useAutoSave({
  id: news?.id ?? "",
  title,
  content,
  enabled: isEdit,
});
```

Watch `autoSaveState` in a `useEffect` — when it transitions to `'saved'`, call `setDirty(false)`.

**Savebar status label** (replaces the current single expression):

| Condition | Label |
|-----------|-------|
| `autoSaveState === 'pending'` | `Saving in a moment…` |
| `autoSaveState === 'saving'` | `Saving…` |
| `autoSaveState === 'saved'` | `Auto-saved · {time}` (HH:MM AM/PM) |
| `autoSaveState === 'error'` | `Couldn't auto-save` |
| `dirty` | `Unsaved changes` |
| `isEdit && !dirty` | `Saved · {updatedLabel}` |
| otherwise | `New article` |

The dot colour class (`dirty` / `saved`) mirrors the existing `.n-savebar-status` CSS classes.

Manual "Save draft" and "Publish now" continue to work exactly as before — they save all fields including `status` and `publish` via `updateNewsAction`.

---

## Tests

**File:** `tests/unit/news-auto-save.test.ts`

### `autoSaveNewsAction`
- Validates that missing `newsId` returns error
- Validates that empty title returns error
- Returns error when user is unauthorized
- Calls `updateNewsInDb` with only `title` and `content` (never `status` or `publish`)
- Returns `{ success: true }` on success

### `useAutoSave` hook
- State starts as `idle`
- Changes to `title` set state to `pending`
- Does NOT save immediately — waits for debounce
- Fires auto-save after debounce delay
- Skips save when `title` is empty
- Sets state to `saved` and calls `onSaved` on success
- Sets state to `error` on action failure
- Cancels pending timer on unmount (no state update after unmount)
- Is a no-op when `enabled = false`

---

## Out of scope

- Auto-save in create mode (no ID yet)
- Auto-saving `status` or `publish` date
- Conflict resolution / versioning
- Offline queue / retry on network failure

# Article/News Social Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins share a published article/news item to Facebook or Telegram (or copy its link) directly from the admin edit forms, and make shared links render a proper title/image/description preview.

**Architecture:** Two new pure-function `lib/` helpers (excerpt extraction, share-URL building) feed a new shared `ShareButtons` component rendered in a sidebar card in both `ArticleForm` and `NewsForm`. Separately, `generateMetadata()` is added to the two public detail pages using the same excerpt helper.

**Tech Stack:** Next.js 16 App Router (`generateMetadata`), React 19, `sonner` (toast, already mounted in `app/admin/layout.tsx`), `lucide-react` (icons, already used in these forms), Vitest + `@testing-library/react`. No new dependencies.

## Global Constraints

- No new npm dependencies (no `react-share` or similar) — hand-rolled URL builders only.
- Only Facebook, Telegram, and Copy Link — no other platforms.
- Share buttons disabled (not hidden) with a tooltip when the item has no id yet or isn't published.
- `NEXT_PUBLIC_SERVER_URL` is read via the existing validated accessor `env` from `data/env/client.ts` — never `process.env` directly in client components.
- CSS additions go in `app/admin-list-view.css`, scoped under `.af-scope`/`.nf-scope`, following the existing `n-*` class naming convention (see lines 3784–3992 for the pattern this extends).
- Every new/modified file gets a test in the matching `tests/unit/`, `tests/component/`, or `tests/api/` folder, per this repo's `CLAUDE.md`.
- Run `npm run test` after every task and confirm all tests pass before moving on.

---

### Task 1: Export `extractPlainText` from `lib/reading-time.ts`

**Files:**
- Modify: `lib/reading-time.ts`
- Test: `tests/unit/reading-time.test.ts` (append)

**Interfaces:**
- Produces: `extractPlainText(contentJson: string | null | undefined): string` — parses a BlockNote JSON document into a single trimmed plain-text string (empty string for null/empty/invalid JSON). Task 2 (`extract-excerpt.ts`) imports this.

This is a refactor: the plain-text-extraction logic already exists inside `estimateReadingTime` but isn't exposed. Pulling it out avoids writing a second BlockNote-JSON parser for the excerpt helper.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/reading-time.test.ts` (add the import and a new `describe` block; keep the existing `estimateReadingTime` describe block untouched):

```typescript
import { describe, it, expect } from "vitest"
import { estimateReadingTime, extractPlainText } from "@/lib/reading-time"

// ... existing describe("estimateReadingTime", ...) block stays exactly as-is ...

describe("extractPlainText", () => {
  // Empty/null/invalid content all collapse to an empty string
  it("returns an empty string for null, empty, or invalid content", () => {
    expect(extractPlainText(null)).toBe("")
    expect(extractPlainText("")).toBe("")
    expect(extractPlainText("[]")).toBe("")
    expect(extractPlainText("not json")).toBe("")
  })

  // Plain paragraph text is extracted and trimmed
  it("extracts and trims paragraph text", () => {
    const content = JSON.stringify([
      { type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
    ])
    expect(extractPlainText(content)).toBe("Hello world")
  })

  // Nested children (e.g. list items) are included in document order
  it("includes nested children text", () => {
    const content = JSON.stringify([
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "top" }],
        children: [{ type: "paragraph", content: [{ type: "text", text: "nested" }] }],
      },
    ])
    expect(extractPlainText(content)).toContain("top")
    expect(extractPlainText(content)).toContain("nested")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/reading-time.test.ts`
Expected: FAIL — `extractPlainText` is not exported from `@/lib/reading-time`.

- [ ] **Step 3: Implement**

Replace the full contents of `lib/reading-time.ts` with:

```typescript
type BlockNoteInline = { text?: unknown; content?: unknown };
type BlockNoteBlock = { content?: unknown; children?: unknown };

function extractInlineText(items: unknown): string {
  if (!Array.isArray(items)) return "";
  let out = "";
  for (const raw of items) {
    const item = raw as BlockNoteInline;
    if (typeof item?.text === "string") out += item.text + " ";
    if (Array.isArray(item?.content)) out += extractInlineText(item.content) + " ";
  }
  return out;
}

function extractBlockText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  let out = "";
  for (const raw of blocks) {
    const block = raw as BlockNoteBlock;
    if (typeof block?.content === "string") out += block.content + " ";
    else if (Array.isArray(block?.content)) out += extractInlineText(block.content) + " ";
    if (Array.isArray(block?.children)) out += extractBlockText(block.children) + " ";
  }
  return out;
}

/** Plain, trimmed text pulled from a BlockNote JSON document. Empty string for null/empty/invalid input. */
export function extractPlainText(contentJson: string | null | undefined): string {
  if (!contentJson) return "";
  let blocks: unknown;
  try {
    blocks = JSON.parse(contentJson);
  } catch {
    return "";
  }
  return extractBlockText(blocks).trim();
}

export type ReadingTime = { words: number; minutes: number };

/** Cosmetic word/read-time estimate from a BlockNote JSON document. Never persisted. */
export function estimateReadingTime(contentJson: string | null | undefined, wordsPerMinute = 200): ReadingTime {
  const text = extractPlainText(contentJson);
  const words = text.length ? text.split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.round(words / wordsPerMinute));
  return { words, minutes };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/unit/reading-time.test.ts`
Expected: PASS (both the pre-existing `estimateReadingTime` tests and the new `extractPlainText` tests).

- [ ] **Step 5: Commit**

```bash
git add lib/reading-time.ts tests/unit/reading-time.test.ts
git commit -m "refactor: export extractPlainText from reading-time for reuse"
```

---

### Task 2: `lib/extract-excerpt.ts`

**Files:**
- Create: `lib/extract-excerpt.ts`
- Test: `tests/unit/extract-excerpt.test.ts`

**Interfaces:**
- Consumes: `extractPlainText` from `@/lib/reading-time` (Task 1).
- Produces: `extractExcerpt(contentJson: string | null | undefined, maxLength?: number): string` — used by Task 8/9's `generateMetadata`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/extract-excerpt.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { extractExcerpt } from "@/lib/extract-excerpt"

describe("extractExcerpt", () => {
  // No content at all collapses to an empty string, never a broken excerpt
  it("returns an empty string for empty or invalid content", () => {
    expect(extractExcerpt("[]")).toBe("")
    expect(extractExcerpt(null)).toBe("")
    expect(extractExcerpt("not json")).toBe("")
  })

  // Content shorter than maxLength is returned verbatim, no trailing ellipsis
  it("returns short content verbatim without an ellipsis", () => {
    const content = JSON.stringify([
      { type: "paragraph", content: [{ type: "text", text: "A short intro." }] },
    ])
    expect(extractExcerpt(content)).toBe("A short intro.")
  })

  // Long content is truncated at a word boundary at/under maxLength and ends with an ellipsis
  it("truncates long content at a word boundary and appends an ellipsis", () => {
    const words = Array(60).fill("gemstone").join(" ") // 60 * 9 = 540 chars, well over 155
    const content = JSON.stringify([{ type: "paragraph", content: [{ type: "text", text: words }] }])
    const excerpt = extractExcerpt(content)
    expect(excerpt.length).toBeLessThanOrEqual(156) // 155 + the ellipsis character
    expect(excerpt.endsWith("…")).toBe(true)
    expect(excerpt.endsWith(" …")).toBe(false) // no trailing space before the ellipsis
  })

  // A custom maxLength is respected
  it("respects a custom maxLength", () => {
    const content = JSON.stringify([
      { type: "paragraph", content: [{ type: "text", text: "one two three four five" }] },
    ])
    const excerpt = extractExcerpt(content, 10)
    expect(excerpt.length).toBeLessThanOrEqual(11)
    expect(excerpt.endsWith("…")).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/extract-excerpt.test.ts`
Expected: FAIL — `lib/extract-excerpt.ts` does not exist.

- [ ] **Step 3: Implement**

Create `lib/extract-excerpt.ts`:

```typescript
import { extractPlainText } from "@/lib/reading-time";

/** Plain-text excerpt from a BlockNote JSON document, truncated at a word boundary. Empty string for empty/invalid content. */
export function extractExcerpt(contentJson: string | null | undefined, maxLength = 155): string {
  const text = extractPlainText(contentJson);
  if (!text) return "";
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  const base = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  return `${base}…`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/unit/extract-excerpt.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/extract-excerpt.ts tests/unit/extract-excerpt.test.ts
git commit -m "feat: add extractExcerpt helper for OG/Twitter descriptions"
```

---

### Task 3: `lib/share-links.ts`

**Files:**
- Create: `lib/share-links.ts`
- Test: `tests/unit/share-links.test.ts`

**Interfaces:**
- Produces: `buildFacebookShareUrl(url: string): string`, `buildTelegramShareUrl(url: string, title: string): string` — used by Task 4's `ShareButtons`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/share-links.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { buildFacebookShareUrl, buildTelegramShareUrl } from "@/lib/share-links"

describe("buildFacebookShareUrl", () => {
  // The target URL is percent-encoded into Facebook's sharer query param
  it("encodes the URL into the sharer query param", () => {
    const url = buildFacebookShareUrl("https://gemx.example.com/articles/abc?ref=admin")
    expect(url).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fgemx.example.com%2Farticles%2Fabc%3Fref%3Dadmin"
    )
  })

  // An empty URL still produces a well-formed (if useless) link, never throws
  it("does not throw for an empty string", () => {
    expect(() => buildFacebookShareUrl("")).not.toThrow()
  })
})

describe("buildTelegramShareUrl", () => {
  // Both the URL and title are percent-encoded, joined with & into Telegram's share params
  it("encodes both the url and title into Telegram's share params", () => {
    const url = buildTelegramShareUrl("https://gemx.example.com/news/xyz", "Big News & Updates")
    expect(url).toBe(
      "https://t.me/share/url?url=https%3A%2F%2Fgemx.example.com%2Fnews%2Fxyz&text=Big%20News%20%26%20Updates"
    )
  })

  // An empty title still produces a well-formed link, never throws
  it("does not throw for an empty title", () => {
    expect(() => buildTelegramShareUrl("https://gemx.example.com/news/xyz", "")).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/share-links.test.ts`
Expected: FAIL — `lib/share-links.ts` does not exist.

- [ ] **Step 3: Implement**

Create `lib/share-links.ts`:

```typescript
/** Facebook's share-dialog URL for a given public link. */
export function buildFacebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

/** Telegram's share-dialog URL for a given public link and pre-filled message text. */
export function buildTelegramShareUrl(url: string, title: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/unit/share-links.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/share-links.ts tests/unit/share-links.test.ts
git commit -m "feat: add Facebook/Telegram share URL builders"
```

---

### Task 4: `components/share/ShareButtons.tsx`

**Files:**
- Create: `components/share/ShareButtons.tsx`
- Test: `tests/component/share-buttons.test.tsx`

**Interfaces:**
- Consumes: `buildFacebookShareUrl`, `buildTelegramShareUrl` from `@/lib/share-links` (Task 3); `toast` from `sonner`.
- Produces: `ShareButtons` component with props `{ url: string; title: string; disabled?: boolean; disabledReason?: string }`. Used by Task 6 (`ArticleForm`) and Task 7 (`NewsForm`).

- [ ] **Step 1: Write the failing test**

Create `tests/component/share-buttons.test.tsx`:

```typescript
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { ShareButtons } from "@/components/share/ShareButtons"

afterEach(cleanup)

const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args), error: (...args: unknown[]) => toastError(...args) },
}))

const writeText = vi.fn()

beforeEach(() => {
  toastSuccess.mockClear()
  toastError.mockClear()
  writeText.mockClear()
  Object.assign(navigator, { clipboard: { writeText } })
})

describe("ShareButtons", () => {
  // Enabled state: all three actions are present and point at the right targets
  it("renders Facebook, Telegram, and Copy link with correct hrefs when enabled", () => {
    render(<ShareButtons url="https://gemx.example.com/articles/abc" title="A Great Article" />)

    const fb = screen.getByRole("link", { name: /facebook/i })
    expect(fb).toHaveAttribute(
      "href",
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fgemx.example.com%2Farticles%2Fabc"
    )

    const tg = screen.getByRole("link", { name: /telegram/i })
    expect(tg).toHaveAttribute(
      "href",
      "https://t.me/share/url?url=https%3A%2F%2Fgemx.example.com%2Farticles%2Fabc&text=A%20Great%20Article"
    )

    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument()
  })

  // Disabled state: anchors have no href (not navigable) and the tooltip reason is shown
  it("disables all three actions and shows the reason as a title tooltip", () => {
    render(
      <ShareButtons
        url=""
        title="A Draft"
        disabled
        disabledReason="Publish first to share"
      />
    )
    expect(screen.getByRole("link", { name: /facebook/i })).not.toHaveAttribute("href")
    expect(screen.getByRole("link", { name: /telegram/i })).not.toHaveAttribute("href")
    expect(screen.getByRole("button", { name: /copy link/i })).toBeDisabled()
    expect(screen.getByTitle("Publish first to share")).toBeInTheDocument()
  })

  // Copy link success: clipboard API is called with the url and a success toast fires
  it("copies the url and shows a success toast", async () => {
    render(<ShareButtons url="https://gemx.example.com/articles/abc" title="A Great Article" />)
    writeText.mockResolvedValueOnce(undefined)

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }))

    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("https://gemx.example.com/articles/abc"))
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Link copied"))
  })

  // Copy link failure: clipboard rejection shows an error toast instead of throwing
  it("shows an error toast when the clipboard write fails", async () => {
    render(<ShareButtons url="https://gemx.example.com/articles/abc" title="A Great Article" />)
    writeText.mockRejectedValueOnce(new Error("denied"))

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }))

    await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith("Couldn't copy link"))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/component/share-buttons.test.tsx`
Expected: FAIL — `components/share/ShareButtons.tsx` does not exist.

- [ ] **Step 3: Implement**

Create `components/share/ShareButtons.tsx`:

```tsx
"use client";

import { Facebook, Send, Copy } from "lucide-react";
import { toast } from "sonner";
import { buildFacebookShareUrl, buildTelegramShareUrl } from "@/lib/share-links";

type ShareButtonsProps = {
  url: string;
  title: string;
  disabled?: boolean;
  disabledReason?: string;
};

export function ShareButtons({ url, title, disabled = false, disabledReason }: ShareButtonsProps) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  return (
    <div className="n-share-row" title={disabled ? disabledReason : undefined}>
      <a
        href={disabled ? undefined : buildFacebookShareUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        className={`n-share-btn${disabled ? " is-disabled" : ""}`}
        aria-disabled={disabled}
      >
        <Facebook size={15} />
        Facebook
      </a>
      <a
        href={disabled ? undefined : buildTelegramShareUrl(url, title)}
        target="_blank"
        rel="noopener noreferrer"
        className={`n-share-btn${disabled ? " is-disabled" : ""}`}
        aria-disabled={disabled}
      >
        <Send size={15} />
        Telegram
      </a>
      <button
        type="button"
        className={`n-share-btn${disabled ? " is-disabled" : ""}`}
        disabled={disabled}
        onClick={handleCopy}
      >
        <Copy size={15} />
        Copy link
      </button>
    </div>
  );
}
```

Note: Telegram's own brand mark isn't in `lucide-react`; `Send` (a paper-plane icon) stands in for it — the visible "Telegram" label makes the target unambiguous. `Facebook` is `lucide-react`'s actual Facebook glyph.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/component/share-buttons.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/share/ShareButtons.tsx tests/component/share-buttons.test.tsx
git commit -m "feat: add ShareButtons component (Facebook, Telegram, copy link)"
```

---

### Task 5: Share-button CSS

**Files:**
- Modify: `app/admin-list-view.css:3988-3993` (insert after the featured-toggle rules, still inside the "EDITOR FORM REDESIGN" section, before the `LABORATORY` section comment at line 3994)

**Interfaces:**
- Produces: `.n-share-row`, `.n-share-btn`, `.n-share-btn.is-disabled` classes, scoped under `.af-scope`/`.nf-scope` — consumed by `ShareButtons` (Task 4) once it's rendered inside either form (Tasks 6/7).

This task has no unit test (pure CSS) — it's verified visually once Tasks 6/7 render the component, and by the existing `share-buttons.test.tsx` className assertions already covered in Task 4's test (`is-disabled` class presence). No new test file.

- [ ] **Step 1: Insert the CSS block**

In `app/admin-list-view.css`, find this existing block (the end of the featured-toggle rules, right before the `LABORATORY` section comment):

```css
.af-scope .n-side-card input[type="checkbox"]:checked,
.nf-scope .n-side-card input[type="checkbox"]:checked { background: var(--lv-accent); }
.af-scope .n-side-card input[type="checkbox"]:checked::before,
.nf-scope .n-side-card input[type="checkbox"]:checked::before { left: 19px; }
```

Insert immediately after it (still before the `/* ═══ LABORATORY (lab-*) ═══ */` comment):

```css

/* ── Share buttons row ────────────────────────────────────────────────── */
.af-scope .n-share-row,
.nf-scope .n-share-row {
  display: flex; gap: 8px; flex-wrap: wrap;
}
.af-scope .n-share-btn,
.nf-scope .n-share-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  flex: 1; min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--lv-border); border-radius: 8px;
  background: #fff; color: var(--lv-text-2);
  font-size: 12.5px; font-weight: 600; font-family: inherit;
  text-decoration: none; cursor: pointer;
  transition: border-color .12s, background .12s;
}
.af-scope .n-share-btn:hover,
.nf-scope .n-share-btn:hover { border-color: var(--lv-border-strong); background: var(--lv-panel-2); }
.af-scope .n-share-btn.is-disabled,
.nf-scope .n-share-btn.is-disabled {
  opacity: 0.45; pointer-events: none; cursor: not-allowed;
}
```

- [ ] **Step 2: Verify no CSS parse errors**

Run: `npm run dev` (or if already running, check its output) and confirm no Turbopack/CSS error is logged. Stop the server after checking if you started it just for this.

- [ ] **Step 3: Commit**

```bash
git add app/admin-list-view.css
git commit -m "style: add n-share-row/n-share-btn classes for share buttons"
```

---

### Task 6: Wire `ShareButtons` into `ArticleForm.tsx`

**Files:**
- Modify: `features/articles/components/ArticleForm.tsx`
- Test: `tests/component/article-share-card.test.tsx`

**Interfaces:**
- Consumes: `ShareButtons` from `@/components/share/ShareButtons` (Task 4); `env` from `@/data/env/client`.

- [ ] **Step 1: Write the failing test**

Create `tests/component/article-share-card.test.tsx`. This mirrors the mocking pattern already used for this form in `tests/component/article-form-save-draft.test.tsx` (mock `next/navigation`, `next/link`, and the article actions):

```typescript
import { afterEach, describe, it, expect, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { ArticleForm } from "@/features/articles/components/ArticleForm"

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
vi.mock("@/features/articles/actions/articles", () => ({
  createArticleAction: vi.fn(),
  updateArticleAction: vi.fn(),
}))
vi.mock("@/features/articles/hooks/useAutoSave", () => ({
  useAutoSave: () => ({ autoSaveState: "idle", lastAutoSaved: null }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const articleRow = {
  id: "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
  title: "Gemstone Identification",
  slug: "gemstone-identification",
  content: "[]",
  author: "Gem X Newsroom",
  category: "gemology",
  coverImage: null,
  isFeatured: false,
  status: "draft" as const,
  publishDate: null,
  createdAt: new Date("2026-07-01"),
  updatedAt: new Date("2026-07-01"),
}

describe("ArticleForm Share card", () => {
  // Create mode has no id yet — sharing is disabled with a "save first" reason
  it("disables sharing in create mode", () => {
    render(<ArticleForm mode="create" />)
    expect(screen.getByTitle("Save first to share")).toBeInTheDocument()
  })

  // Edit mode, still a draft — sharing is disabled with a "publish first" reason
  it("disables sharing for a draft in edit mode", () => {
    render(<ArticleForm mode="edit" article={articleRow} />)
    expect(screen.getByTitle("Publish first to share")).toBeInTheDocument()
  })

  // Edit mode, published — sharing is enabled and the link targets the public article URL
  it("enables sharing for a published article and builds the correct public URL", () => {
    render(<ArticleForm mode="edit" article={{ ...articleRow, status: "published" }} />)
    const fb = screen.getByRole("link", { name: /facebook/i })
    expect(fb.getAttribute("href")).toContain(encodeURIComponent(`/articles/${articleRow.id}`))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/component/article-share-card.test.tsx`
Expected: FAIL — no "Save first to share" tooltip exists yet.

- [ ] **Step 3: Implement**

In `features/articles/components/ArticleForm.tsx`:

Add two imports, right after the existing `import { ContentMetaCard } ...` line (line 13):

```typescript
import { ContentMetaCard } from "@/features/news/components/ContentMetaCard";
import { ShareButtons } from "@/components/share/ShareButtons";
import { env } from "@/data/env/client";
```

Add a `shareUrl`/`shareDisabledReason` computation right after the existing `const readingTime = estimateReadingTime(content);` line (line 115):

```typescript
  const readingTime = estimateReadingTime(content);

  const shareUrl = article?.id && env.NEXT_PUBLIC_SERVER_URL
    ? `${env.NEXT_PUBLIC_SERVER_URL}/articles/${article.id}`
    : "";
  const shareDisabledReason = !env.NEXT_PUBLIC_SERVER_URL
    ? "Sharing unavailable"
    : !isEdit || !article?.id
      ? "Save first to share"
      : status !== "published"
        ? "Publish first to share"
        : undefined;
```

Insert a new sidebar card right after the Publishing card closes (after the `</div>` on line 405, before the `{/* Mobile display card: category, cover, featured */}` comment on line 407):

```tsx
            </div>

            {/* Share card */}
            <div className="n-side-card">
              <div className="n-side-card-head">
                <span className="n-side-card-ico" data-tone="blue">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M13 4.5a2.5 2.5 0 1 1-4.75 1.4l-3.5 2.1a2.5 2.5 0 0 1 0 1l3.5 2.1a2.5 2.5 0 1 1-.75 1.75l-3.5-2.1a2.5 2.5 0 1 1 0-3.5l3.5-2.1A2.5 2.5 0 0 1 13 4.5Z" clipRule="evenodd" />
                  </svg>
                </span>
                <div>
                  <div className="n-side-card-title">Share</div>
                  <div className="n-side-card-sub">Post the public link.</div>
                </div>
              </div>
              <div className="n-side-card-body">
                <ShareButtons
                  url={shareUrl}
                  title={title}
                  disabled={shareDisabledReason !== undefined}
                  disabledReason={shareDisabledReason}
                />
              </div>
            </div>

            {/* Mobile display card: category, cover, featured */}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/component/article-share-card.test.tsx`
Expected: PASS

- [ ] **Step 4b: Add coverage for the missing-env-var case**

The "Sharing unavailable" path (missing `NEXT_PUBLIC_SERVER_URL`) needs `env` mocked to an empty value, which would conflict with the other tests in the same file (they need the URL present). Create a separate file for it: `tests/component/article-share-card-no-server-url.test.tsx`:

```typescript
import { afterEach, describe, it, expect, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { ArticleForm } from "@/features/articles/components/ArticleForm"

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
vi.mock("@/features/articles/actions/articles", () => ({
  createArticleAction: vi.fn(),
  updateArticleAction: vi.fn(),
}))
vi.mock("@/features/articles/hooks/useAutoSave", () => ({
  useAutoSave: () => ({ autoSaveState: "idle", lastAutoSaved: null }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/data/env/client", () => ({ env: { NEXT_PUBLIC_SERVER_URL: undefined } }))

const publishedArticle = {
  id: "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
  title: "Gemstone Identification",
  slug: "gemstone-identification",
  content: "[]",
  author: "Gem X Newsroom",
  category: "gemology",
  coverImage: null,
  isFeatured: false,
  status: "published" as const,
  publishDate: null,
  createdAt: new Date("2026-07-01"),
  updatedAt: new Date("2026-07-01"),
}

describe("ArticleForm Share card without NEXT_PUBLIC_SERVER_URL", () => {
  // Even a published article can't build a real share URL without the base domain —
  // sharing is disabled with a distinct reason instead of constructing a broken link
  it("disables sharing with 'Sharing unavailable' when the env var is missing", () => {
    render(<ArticleForm mode="edit" article={publishedArticle} />)
    expect(screen.getByTitle("Sharing unavailable")).toBeInTheDocument()
  })
})
```

Run: `npm run test -- tests/component/article-share-card-no-server-url.test.tsx`
Expected: PASS

Then run the full existing ArticleForm test suite to confirm no regressions:

Run: `npm run test -- tests/component/article-form-save-draft.test.tsx tests/component/product-form-nav.test.tsx`
Expected: PASS (these exercise other parts of `ArticleForm`/prev-next nav that must keep working)

- [ ] **Step 5: Commit**

```bash
git add features/articles/components/ArticleForm.tsx tests/component/article-share-card.test.tsx tests/component/article-share-card-no-server-url.test.tsx
git commit -m "feat: add Share card to ArticleForm sidebar"
```

---

### Task 7: Wire `ShareButtons` into `NewsForm.tsx`

**Files:**
- Modify: `features/news/components/NewsForm.tsx`
- Test: `tests/component/news-share-card.test.tsx`

**Interfaces:**
- Consumes: `ShareButtons` from `@/components/share/ShareButtons` (Task 4); `env` from `@/data/env/client`.

Identical shape to Task 6, using `news`/`NewsRow` instead of `article`/`ArticleRow` and the `/news/{id}` URL.

- [ ] **Step 1: Write the failing test**

Create `tests/component/news-share-card.test.tsx`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/component/news-share-card.test.tsx`
Expected: FAIL — no "Save first to share" tooltip exists yet.

- [ ] **Step 3: Implement**

In `features/news/components/NewsForm.tsx`:

Add two imports right after the existing `import { ContentMetaCard } ...` line (line 13):

```typescript
import { ContentMetaCard } from "@/features/news/components/ContentMetaCard";
import { ShareButtons } from "@/components/share/ShareButtons";
import { env } from "@/data/env/client";
```

Add a `shareUrl`/`shareDisabledReason` computation right after the existing `const readingTime = estimateReadingTime(content);` line (line 112):

```typescript
  const readingTime = estimateReadingTime(content);

  const shareUrl = news?.id && env.NEXT_PUBLIC_SERVER_URL
    ? `${env.NEXT_PUBLIC_SERVER_URL}/news/${news.id}`
    : "";
  const shareDisabledReason = !env.NEXT_PUBLIC_SERVER_URL
    ? "Sharing unavailable"
    : !isEdit || !news?.id
      ? "Save first to share"
      : status !== "published"
        ? "Publish first to share"
        : undefined;
```

Insert a new sidebar card right after the Publishing card closes (after the `</div>` on line 398, before the `{/* Mobile display card: category, cover, featured */}` comment on line 400):

```tsx
            </div>

            {/* Share card */}
            <div className="n-side-card">
              <div className="n-side-card-head">
                <span className="n-side-card-ico" data-tone="blue">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M13 4.5a2.5 2.5 0 1 1-4.75 1.4l-3.5 2.1a2.5 2.5 0 0 1 0 1l3.5 2.1a2.5 2.5 0 1 1-.75 1.75l-3.5-2.1a2.5 2.5 0 1 1 0-3.5l3.5-2.1A2.5 2.5 0 0 1 13 4.5Z" clipRule="evenodd" />
                  </svg>
                </span>
                <div>
                  <div className="n-side-card-title">Share</div>
                  <div className="n-side-card-sub">Post the public link.</div>
                </div>
              </div>
              <div className="n-side-card-body">
                <ShareButtons
                  url={shareUrl}
                  title={title}
                  disabled={shareDisabledReason !== undefined}
                  disabledReason={shareDisabledReason}
                />
              </div>
            </div>

            {/* Mobile display card: category, cover, featured */}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/component/news-share-card.test.tsx`
Expected: PASS

- [ ] **Step 4b: Add coverage for the missing-env-var case**

Same rationale as Task 6 Step 4b — create a separate file so the mocked `env` doesn't affect the other tests in `news-share-card.test.tsx`. Create `tests/component/news-share-card-no-server-url.test.tsx`:

```typescript
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
```

Run: `npm run test -- tests/component/news-share-card-no-server-url.test.tsx`
Expected: PASS

Then run the full existing NewsForm-adjacent suite to confirm no regressions:

Run: `npm run test -- tests/component/news-auto-save-hook.test.tsx tests/component/content-meta-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add features/news/components/NewsForm.tsx tests/component/news-share-card.test.tsx tests/component/news-share-card-no-server-url.test.tsx
git commit -m "feat: add Share card to NewsForm sidebar"
```

---

### Task 8: `generateMetadata` for `app/articles/[id]/page.tsx`

**Files:**
- Modify: `app/articles/[id]/page.tsx`
- Test: `tests/api/article-metadata.test.ts`

**Interfaces:**
- Consumes: `getArticleById` from `@/features/articles/db/articles` (existing); `extractExcerpt` from `@/lib/extract-excerpt` (Task 2).

- [ ] **Step 1: Write the failing test**

Create `tests/api/article-metadata.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { connection } from "next/server"
import { getArticleById } from "@/features/articles/db/articles"
import { generateMetadata } from "@/app/articles/[id]/page"

vi.mock("next/server", () => ({
  connection: vi.fn(),
}))
vi.mock("@/features/articles/db/articles", () => ({
  getArticleById: vi.fn(),
}))

const params = (id: string) => Promise.resolve({ id })

const publishedArticle = {
  id: "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
  title: "Gemstone Identification",
  slug: "gemstone-identification",
  content: JSON.stringify([{ type: "paragraph", content: [{ type: "text", text: "How to verify a gemstone." }] }]),
  author: "Gem X Newsroom",
  category: "gemology",
  coverImage: "https://cdn.example.com/cover.jpg",
  isFeatured: false,
  status: "published",
  publishDate: new Date("2026-05-20"),
  createdAt: new Date("2026-05-18"),
  updatedAt: new Date("2026-05-20"),
}

describe("generateMetadata for /articles/[id]", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
  })

  // A published article with a cover image gets a full OG/Twitter card
  it("returns title, description, and image metadata for a published article", async () => {
    vi.mocked(getArticleById).mockResolvedValue(publishedArticle)
    const metadata = await generateMetadata({ params: params(publishedArticle.id) })
    expect(metadata.title).toBe("Gemstone Identification")
    expect(metadata.description).toBe("How to verify a gemstone.")
    expect(metadata.openGraph?.images).toEqual(["https://cdn.example.com/cover.jpg"])
    expect(metadata.twitter?.card).toBe("summary_large_image")
  })

  // No cover image means the images fields are omitted, not a broken/empty array
  it("omits image fields when there is no cover image", async () => {
    vi.mocked(getArticleById).mockResolvedValue({ ...publishedArticle, coverImage: null })
    const metadata = await generateMetadata({ params: params(publishedArticle.id) })
    expect(metadata.openGraph?.images).toBeUndefined()
    expect(metadata.twitter?.images).toBeUndefined()
  })

  // Drafts never leak metadata — falls back to the root layout's defaults
  it("returns empty metadata for a draft article", async () => {
    vi.mocked(getArticleById).mockResolvedValue({ ...publishedArticle, status: "draft" })
    const metadata = await generateMetadata({ params: params(publishedArticle.id) })
    expect(metadata).toEqual({})
  })

  // Non-existent id returns empty metadata rather than throwing
  it("returns empty metadata for a non-existent id", async () => {
    vi.mocked(getArticleById).mockResolvedValue(null)
    const metadata = await generateMetadata({ params: params("does-not-exist") })
    expect(metadata).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/api/article-metadata.test.ts`
Expected: FAIL — `generateMetadata` is not exported from `@/app/articles/[id]/page`.

- [ ] **Step 3: Implement**

Replace the full contents of `app/articles/[id]/page.tsx` with:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { HomeNavbar } from "@/components/home/HomeNavbar";
import { HomeFooter } from "@/components/home/HomeFooter";
import { getArticleById } from "@/features/articles/db/articles";
import { extractExcerpt } from "@/lib/extract-excerpt";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { id } = await params;
  const article = await getArticleById(id);

  if (!article || article.status !== "published") {
    return {};
  }

  const description = extractExcerpt(article.content) || undefined;
  const images = article.coverImage ? [article.coverImage] : undefined;

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      images,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images,
    },
  };
}

export default async function ArticleDetailPage({ params }: Props) {
  await connection();
  const { id } = await params;
  const article = await getArticleById(id);

  if (!article || article.status !== "published") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <HomeNavbar />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
        <article className="mt-6">
          <p className="text-sm text-muted-foreground">
            {article.author}
            {article.publishDate
              ? ` · ${new Date(article.publishDate).toLocaleDateString()}`
              : null}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
            {article.title}
          </h1>
          <p className="mt-6 leading-relaxed text-muted-foreground">
            Open this article in the GemX app for full rich content. Article ID: {article.id}
          </p>
        </article>
      </main>
      <HomeFooter />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/api/article-metadata.test.ts`
Expected: PASS

Then run the existing articles API/page suite to confirm no regressions:

Run: `npm run test -- tests/api/articles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/articles/\[id\]/page.tsx tests/api/article-metadata.test.ts
git commit -m "feat: add Open Graph/Twitter Card metadata to article detail page"
```

---

### Task 9: `generateMetadata` for `app/news/[id]/page.tsx`

**Files:**
- Modify: `app/news/[id]/page.tsx`
- Test: `tests/api/news-metadata.test.ts`

**Interfaces:**
- Consumes: `getNewsById` from `@/features/news/db/news` (existing); `extractExcerpt` from `@/lib/extract-excerpt` (Task 2).

Identical shape to Task 8.

- [ ] **Step 1: Write the failing test**

Create `tests/api/news-metadata.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { connection } from "next/server"
import { getNewsById } from "@/features/news/db/news"
import { generateMetadata } from "@/app/news/[id]/page"

vi.mock("next/server", () => ({
  connection: vi.fn(),
}))
vi.mock("@/features/news/db/news", () => ({
  getNewsById: vi.fn(),
}))

const params = (id: string) => Promise.resolve({ id })

const publishedNews = {
  id: "1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d",
  title: "New Verification Process",
  content: JSON.stringify([{ type: "paragraph", content: [{ type: "text", text: "We've updated verification." }] }]),
  author: "Gem X Newsroom",
  category: "general",
  coverImage: "https://cdn.example.com/news-cover.jpg",
  isFeatured: false,
  status: "published",
  publish: new Date("2026-06-01"),
  createdAt: new Date("2026-05-30"),
  updatedAt: new Date("2026-06-01"),
}

describe("generateMetadata for /news/[id]", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
  })

  // Published news with a cover image gets a full OG/Twitter card
  it("returns title, description, and image metadata for published news", async () => {
    vi.mocked(getNewsById).mockResolvedValue(publishedNews)
    const metadata = await generateMetadata({ params: params(publishedNews.id) })
    expect(metadata.title).toBe("New Verification Process")
    expect(metadata.description).toBe("We've updated verification.")
    expect(metadata.openGraph?.images).toEqual(["https://cdn.example.com/news-cover.jpg"])
    expect(metadata.twitter?.card).toBe("summary_large_image")
  })

  // No cover image means the images fields are omitted, not a broken/empty array
  it("omits image fields when there is no cover image", async () => {
    vi.mocked(getNewsById).mockResolvedValue({ ...publishedNews, coverImage: null })
    const metadata = await generateMetadata({ params: params(publishedNews.id) })
    expect(metadata.openGraph?.images).toBeUndefined()
    expect(metadata.twitter?.images).toBeUndefined()
  })

  // Drafts never leak metadata — falls back to the root layout's defaults
  it("returns empty metadata for draft news", async () => {
    vi.mocked(getNewsById).mockResolvedValue({ ...publishedNews, status: "draft" })
    const metadata = await generateMetadata({ params: params(publishedNews.id) })
    expect(metadata).toEqual({})
  })

  // Non-existent id returns empty metadata rather than throwing
  it("returns empty metadata for a non-existent id", async () => {
    vi.mocked(getNewsById).mockResolvedValue(null)
    const metadata = await generateMetadata({ params: params("does-not-exist") })
    expect(metadata).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/api/news-metadata.test.ts`
Expected: FAIL — `generateMetadata` is not exported from `@/app/news/[id]/page`.

- [ ] **Step 3: Implement**

Replace the full contents of `app/news/[id]/page.tsx` with:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { HomeNavbar } from "@/components/home/HomeNavbar";
import { HomeFooter } from "@/components/home/HomeFooter";
import { getNewsById } from "@/features/news/db/news";
import { extractExcerpt } from "@/lib/extract-excerpt";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { id } = await params;
  const item = await getNewsById(id);

  if (!item || item.status !== "published") {
    return {};
  }

  const description = extractExcerpt(item.content) || undefined;
  const images = item.coverImage ? [item.coverImage] : undefined;

  return {
    title: item.title,
    description,
    openGraph: {
      title: item.title,
      description,
      images,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: item.title,
      description,
      images,
    },
  };
}

export default async function NewsDetailPage({ params }: Props) {
  await connection();
  const { id } = await params;
  const item = await getNewsById(id);

  if (!item || item.status !== "published") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <HomeNavbar />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
        <article className="mt-6">
          <p className="text-sm text-muted-foreground">
            {item.publish ? new Date(item.publish).toLocaleDateString() : null}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">{item.title}</h1>
          <p className="mt-6 leading-relaxed text-muted-foreground">
            Open this news item in the GemX app for full rich content. News ID: {item.id}
          </p>
        </article>
      </main>
      <HomeFooter />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/api/news-metadata.test.ts`
Expected: PASS

Then run the existing news API suite to confirm no regressions:

Run: `npm run test -- tests/api/news.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/news/\[id\]/page.tsx tests/api/news-metadata.test.ts
git commit -m "feat: add Open Graph/Twitter Card metadata to news detail page"
```

---

### Task 10: Documentation and full verification

**Files:**
- Create: `docs/technical/article-news-social-sharing.md`
- Create: `docs/guides/social-sharing.md`

**Interfaces:** None — documentation only. No `app/api/` route was created or modified in this plan (Tasks 8/9 touch `app/articles/[id]/page.tsx` and `app/news/[id]/page.tsx`, which are page routes, not API routes), so per this repo's `CLAUDE.md` "After Every Change" rule, no `docs/api/` entry is required.

- [ ] **Step 1: Write the technical doc**

Create `docs/technical/article-news-social-sharing.md`:

```markdown
# Article/News Social Sharing

## What changed

- `lib/reading-time.ts` — exported `extractPlainText` (previously private), reused by the new excerpt helper.
- `lib/extract-excerpt.ts` (new) — truncates BlockNote content to a ~155-char plain-text excerpt for meta descriptions.
- `lib/share-links.ts` (new) — pure Facebook/Telegram share-URL builders.
- `components/share/ShareButtons.tsx` (new) — Facebook, Telegram, and Copy Link actions, used by both forms below.
- `features/articles/components/ArticleForm.tsx` — new "Share" sidebar card.
- `features/news/components/NewsForm.tsx` — new "Share" sidebar card.
- `app/articles/[id]/page.tsx`, `app/news/[id]/page.tsx` — added `generateMetadata()` for Open Graph/Twitter Card tags.
- `app/admin-list-view.css` — added `.n-share-row`/`.n-share-btn` classes.

## Data flow

Admin form loads `article`/`news` row (id, title, status, coverImage already present in props) → form computes `shareUrl` as `${env.NEXT_PUBLIC_SERVER_URL}/articles/{id}` (or `/news/{id}`) and a `disabledReason` from `mode`/`id`/`status` → `ShareButtons` renders three actions built from `shareUrl`/`title`, or a disabled+tooltip state.

Separately, on any request to the public detail page, `generateMetadata()` re-fetches the same row via `getArticleById`/`getNewsById`, and if `status === "published"`, builds `title`/`description`/`openGraph`/`twitter` fields using `extractExcerpt(content)` and `coverImage`. This is a second DB round-trip beyond the page component's own fetch — accepted since both are single-row primary-key lookups.

## Schema impact

None. No Drizzle schema changes.

## Auth & permissions

No new auth surface. `ShareButtons` is a client component rendered only inside the already-guarded `/admin/articles/*` and `/admin/news/*` pages. `generateMetadata()` runs unauthenticated (same as the public page it's attached to) and only ever reads published rows.

## Edge cases & known limitations

- Facebook/Telegram/Copy Link only — no other platforms, no auto-posting/OAuth.
- Share card is disabled (not hidden) in create mode and while the item is a draft.
- Missing `NEXT_PUBLIC_SERVER_URL` disables sharing entirely rather than building a broken URL.
- Missing `coverImage` omits `images` from metadata rather than emitting a broken image tag.
- The duplicate DB fetch between `generateMetadata` and the page component is not cached/deduped — out of scope for this change.
```

- [ ] **Step 2: Write the collaborator guide**

Create `docs/guides/social-sharing.md`:

```markdown
# Social Sharing (Articles & News)

## Prerequisites

- `NEXT_PUBLIC_SERVER_URL` must be set (e.g. `http://localhost:3000` locally, the production domain in prod) — without it, share buttons show as disabled with "Sharing unavailable".

## Using it

1. Open `/admin/articles/{id}/edit` (or `/admin/news/{id}/edit`) for a **published** item.
2. In the sidebar, the "Share" card shows three actions: **Facebook**, **Telegram**, **Copy link**.
3. Facebook/Telegram open that platform's own share dialog in a new tab, pre-filled with the public URL (and title, for Telegram).
4. Copy link copies the public URL to the clipboard and shows a toast.

While the item is a draft, or on the "New" form before it's ever been saved, the three actions are greyed out — hover to see why (a native tooltip via the `title` attribute).

## Extending it

- **Add another platform:** add a `buildXShareUrl()` function to `lib/share-links.ts`, then add one more `<a>` to `components/share/ShareButtons.tsx` following the existing Facebook/Telegram pattern. No prop changes needed — every consumer of `ShareButtons` gets the new button automatically.
- **Change the excerpt length:** pass a second argument to `extractExcerpt(content, 200)` in either page's `generateMetadata`.
- **Add sharing to another content type:** reuse `ShareButtons` directly — it only needs a `url` and a `title`, it has no article/news-specific logic.

## Common errors

- **"Sharing unavailable" tooltip in prod:** `NEXT_PUBLIC_SERVER_URL` isn't set for that environment — set it and redeploy.
- **Facebook/Telegram preview shows no image:** the item's `coverImage` is empty — set one via the "Cover image" field in the sidebar's mobile-display card.
- **Preview shows stale title/description after an edit:** Facebook/Telegram cache link previews aggressively; use each platform's own cache-debugger tool (e.g. Facebook's Sharing Debugger) to force a re-scrape — this is a platform-side cache, not a bug in this app.
```

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: PASS — every test added in Tasks 1–9, plus every pre-existing test, all green.

- [ ] **Step 4: Run the linter**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add docs/technical/article-news-social-sharing.md docs/guides/social-sharing.md
git commit -m "docs: add technical doc and collaborator guide for social sharing"
```

---

## Out of scope

(Carried over from the design spec — not implemented by this plan.)

- X (Twitter), WhatsApp, LinkedIn, or any platform beyond Facebook/Telegram/Copy Link
- Auto-posting via platform APIs / OAuth-connected accounts
- Slug-based public URLs
- Caching/deduping the `generateMetadata`/page-component double DB fetch
- Share analytics/click tracking

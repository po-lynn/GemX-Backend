# Guide: Adding a Clear Button to a Search Input

All search boxes in GemX show a clear (X) icon when they contain text. This guide shows how to add the same behavior to a new search input.

## Prerequisites

None beyond the existing stack — `lucide-react` is already installed.

## The pattern

1. Wrap the input in a `position: relative` container (most search inputs already have one for the leading `Search` icon).
2. Reserve right padding on the input (`pr-8` in Tailwind, or `paddingRight: 32` inline) so text doesn't run under the button.
3. Render the button only when the value is non-empty, with `type="button"` and `aria-label="Clear search"`.
4. On click, reset the same state the input's `onChange` writes, plus any dependent state (selection, page number, result list).

### Tailwind / shadcn `Input` example

```tsx
import { Search, X } from "lucide-react"

<div className="relative">
  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
  <Input
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    placeholder="Search…"
    className="pl-9 pr-8"
  />
  {query && (
    <button
      type="button"
      onClick={() => setQuery("")}
      aria-label="Clear search"
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
    >
      <X className="size-3.5" />
    </button>
  )}
</div>
```

### Inline-styled admin inputs (points/product dialogs)

Follow `features/points/components/AdminCreditPointsForm.tsx` — same idea with inline styles and `color: "var(--lv-text-3)"`.

### List-view toolbar

`components/admin/list-view/ListViewCard.tsx` swaps the ⌘K badge for the X while a query exists. The button style lives in `app/admin-list-view.css` as `.lv-search-clear` — reuse that class inside any `.lv-search` container.

### Command palettes

`CommandInput` in `components/ui/command.tsx` has the clear button built in. Uncontrolled usage (`<CommandInput placeholder="…" />`) gets it for free. If you control the value, pass `value` and `onValueChange` — clearing calls `onValueChange("")`.

## Things to reset besides the text

- **Debounced fetches** — cancel the pending timer so a stale response doesn't reappear (see `handleClear` in `components/admin/AdminSearchBox.tsx`).
- **Selection state** — user pickers also clear the selected user.
- **Pagination** — search-driven lists reset to page 1.
- **URL params** — URL-driven searches (e.g. `ProductsSearchInput`) must also delete the `search`/`page` params and navigate.

## Common errors

- **X overlaps the text** — you forgot the right padding on the input.
- **Clicking X submits a form** — missing `type="button"`.
- **cmdk tests crash with `ResizeObserver is not defined`** — stub it in the test file (see `tests/component/search-clear-button.test.tsx`).
- **Dropdown closes before the click registers** — if the input's `onBlur` hides the list with no delay, use `onMouseDown` with `e.preventDefault()` on the button, or a short `setTimeout` in `onBlur` (the existing inputs already do the latter).

## Testing

Query the button by `screen.getByLabelText("Clear search")`; assert it's absent when the input is empty, appears after typing, and empties the input on click. See `tests/component/search-clear-button.test.tsx` for reference tests.

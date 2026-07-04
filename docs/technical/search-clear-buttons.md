# Search Clear Buttons

## What changed

Every search box in the web/admin UI now shows a clear (X) button when it contains text. Clicking it empties the input, resets any dependent state (results, selection, pagination), and — where the previous UI element made sense — restores it (e.g. the ⌘K badge in the list-view toolbar).

Files touched:

| File | Search box | Clear behavior |
|------|-----------|----------------|
| `components/admin/AdminSearchBox.tsx` | Admin header global search | Clears query + results, cancels pending debounce, closes dropdown, refocuses input |
| `components/admin/list-view/ListViewCard.tsx` | List-view toolbar search | Clears query and calls `onSearch("")`; X replaces the ⌘K badge while a query exists |
| `app/admin-list-view.css` | — | New `.lv-search-clear` style for the list-view clear button |
| `components/ui/command.tsx` | `CommandInput` (shadcn/cmdk) | Wrapper now tracks the search value (controlled or uncontrolled) and renders an X that resets it |
| `features/chat/components/ChatDashboard.tsx` | Sidebar "Chats search…" | Clears local `search` state (chat dialogs get clear via `CommandInput`) |
| `features/messages/components/MessagesAdminPanel.tsx` | "Search messages" filter | Clears `draftSearch` (applied filters unchanged until Apply) |
| `features/points/components/ActivatePremiumDealerDialog.tsx` | User picker | Clears query + selected user |
| `features/points/components/AdminCreatePurchaseRequestDialog.tsx` | User picker | Clears query + selected user |
| `features/points/components/AdminCreditPointsForm.tsx` | User picker | Clears query + selection |
| `features/points/components/PointActionButtons.tsx` | Drawer user picker | Clears query + selection |
| `features/products/components/ProductForm.tsx` | Seller modal search + inline seller combobox | Modal: clears query, resets page to 1. Combobox: X replaces the chevron while a query exists; clearing closes the dropdown via the existing debounce effect |

`features/products/components/ProductsSearchInput.tsx` already had a clear button and is unchanged; its pattern (absolute-positioned button, `aria-label="Clear search"`, lucide `X`) was used as the reference.

## Data flow

Purely client-side. Each clear button resets the same React state its input's `onChange` writes (`query` / `search` / `draftSearch`), so downstream behavior (debounced server actions, URL params, list filtering) follows the existing paths — no new requests, routes, or schema.

`CommandInput` change in detail: cmdk's input state was previously internal, so the wrapper couldn't know when to show an X. The wrapper now holds a local `search` state and passes `value`/`onValueChange` down. If the consumer passes `value` themselves, the wrapper defers to them (controlled mode) and only forwards `onValueChange("")` on clear.

## Schema impact

None.

## Auth & permissions

None — UI-only change, no auth contexts affected.

## Edge cases & known limitations

- All clear buttons use `aria-label="Clear search"` for accessibility/testing.
- In the points dialogs the input's `onBlur` hides the results list after 150 ms; clicking the X blurs the input, so the list closes as part of clearing — intended.
- In `AdminSearchBox` a click on X while a debounced search is pending cancels the timer and resets `loading`, so a stale response can't repopulate the dropdown.
- `MessagesAdminPanel` clears only the *draft* search; the user still presses Apply to refetch, consistent with the other draft filters.
- jsdom lacks `ResizeObserver` (needed by cmdk); the test file stubs it.

## Tests

`tests/component/search-clear-button.test.tsx` — 6 tests covering AdminSearchBox (hidden when empty, shown when typed, clears on click) and CommandInput (uncontrolled show/clear, controlled `onValueChange("")`).

# Messages Triage Inbox — Collaborator Guide

## Prerequisites

Normal dev setup — the page now reads real data, so you need a working
`DATABASE_URL` with some rows in the `messages` table (any local dev seed
data works). Visit `/admin/messages` while logged in as `admin` (or an
`internal` user with the `messages` or `chat_dashboard` permission).

## Using it end-to-end

1. Go to `/admin/messages`.
2. **Mode toggle** (top right of the page header) switches the middle list
   between "Conversations" (one row per thread) and "All messages" (one row
   per message — selecting one opens its parent thread in the reading pane).
3. **Filter rails** (left, 212px): STATUS and TYPE are independent filters
   that AND together — e.g. Status=Flagged + Type=Escrow shows only flagged
   escrow conversations. Counts update live based on the *other* rail's
   selection plus the current mode. Note: Awaiting reply/Assigned to
   me/Resolved always show 0 against real data — there's no schema backing
   them yet (see the technical doc's "Known gaps").
4. **Search** (top of the middle list) filters instantly across participant
   names, message body/preview, tag, and SKU (messages mode only).
5. **Sort toggle** (next to the result count) flips newest/oldest by
   timestamp.
6. Click a row to load it into the **reading pane** (right) — this fetches
   the real thread from `GET /api/admin/messages/thread`, showing a spinner
   while it loads and a retry card if it fails. The header shows both
   participants, message count, conversation type, and a thread number. A
   flagged thread shows an amber policy banner above the message scroller.
7. **Flag** and **Delete** are real, persisted actions, but **only in
   "All messages" mode** — switch there first. In Conversations mode they
   still show a "Not wired yet in this preview" toast, since there's no
   single message those buttons could unambiguously act on there.
   - Flag toggles the message's real `starred` column and refreshes.
   - Delete opens a confirmation dialog, then hard-deletes the message on
     confirm (matches how delete already worked in the old Messages table
     view) and refreshes.
8. Resolve / Export / New message / the `⋯` overflow button are still inert
   placeholders — clicking any of them shows the same toast. The internal
   note bar's input works but "Save" doesn't persist anything yet.

All filter/sort/search/selection state lives in the URL
(`?mode=&status=&type=&query=&sortDesc=&selectedId=`), so any view is
shareable/bookmarkable and the back button works.

## Extending it

**Add a new status filter value:**
1. Add it to `StatusFilter` in `features/messages/types/triage.ts`.
2. Add a label to `STATUS_LABELS` and append it to `STATUS_FILTERS` in
   `features/messages/lib/triage-filters.ts`.
3. Add an icon mapping in `STATUS_ICONS` in
   `features/messages/components/triage/FilterRails.tsx`.
4. Populate the corresponding boolean in `getTriageConversationsFromDb()`/
   `getTriageMessagesFromDb()` (`features/messages/db/triage.ts`) — this
   likely needs new schema/columns first, see the technical doc's "Schema
   impact" section — and extend `matchesStatus()`'s switch in
   `triage-filters.ts`.

**Add a new field to a list row (e.g. a priority badge):**
1. Add the field to `TriageConversation`/`TriageMessage` in `types/triage.ts`.
2. Populate it in `getTriageConversationsFromDb()`/`getTriageMessagesFromDb()`
   (`features/messages/db/triage.ts`).
3. Thread it through the `TriageListRow` shape built in
   `MessagesTriagePage.tsx`'s `listRows` memo, and render it in
   `ConversationList.tsx`'s row markup.

**Wire up Resolve/Assign/Notes for real** (needs new schema first — see
"Schema impact" in the technical doc):
1. Design and migrate the new tables/columns (conversation resolution,
   assignment, internal notes, audit log). This project applies migrations
   manually — write the migration, but don't run `db:migrate` yourself.
2. Add query functions in `features/messages/db/triage.ts` alongside the
   existing two, and a server action per mutation in
   `features/messages/actions/messages.ts` (or a new file), following the
   `setMessageStarredAction`/`deleteMessageAction` pattern: validate input,
   check auth, mutate, return `{ success }` or `{ error }`.
3. Replace the corresponding `notWiredToast()` call in
   `MessagesTriagePage.tsx` with a real handler — mirror `handleFlag()`/
   `confirmDelete()` there for the call-action-then-`router.refresh()`
   pattern.

**Give conversation `type` a real backing** (currently a text-pattern
heuristic — see `classifyType()` in `features/messages/db/triage.ts` and the
technical doc's "Schema impact"):
1. Add a real `type` column (or similar) to whatever table ends up backing
   conversations.
2. Find every code path that sends an escrow-request or system/Contact-Us
   message and have it stamp the new column directly at send time, instead
   of relying on the heuristic.
3. Delete `classifyType()` and read the real column in
   `getTriageConversationsFromDb()`/`getTriageMessagesFromDb()` instead.

## Common errors

- **"Not wired yet in this preview" toast** — expected for Resolve/Export/
  New message/`⋯` everywhere, and for Flag/Delete specifically in
  Conversations mode. Not a bug — see "Known gaps" in the technical doc.
- **Redirected away from `/admin/messages`** — you need the `messages` or
  `chat_dashboard` RBAC permission (or `admin` role). Grant it at
  `/admin/settings` → permissions editor.
- **Reading pane stuck on the loading spinner or showing a retry card** —
  the thread fetch (`GET /api/admin/messages/thread`) failed or is slow;
  check the network tab / server logs. Retry re-fires the same fetch.
- **Reading pane shows "Select a conversation to view its messages"
  unexpectedly** — only happens when there are no messages in the database
  at all, or a filter combination matches zero rows; check the result label
  above the list for "No matches."
- **Attachment message shows an image thumbnail / audio player / clickable
  "Attachment" link, not just the plain word "Attachment"** — this is the
  fixed, expected behavior. **A single-image message (the common case) has
  `fileUrl` set but `imageUrls: null`** — `imageUrls` is only populated for
  multi-image gallery sends — so it must still resolve to an inline image
  via `messageType === "image"` + `fileUrl`, not just via `imageUrls`. If you
  see a bare, unclickable "Attachment" (or "Photo"/"Voice message") text
  with nothing behind it, that's the phase-3/3b regression — check that
  `MessagesTriagePage.tsx`'s thread mapping still
  passes `fileUrl`/`imageUrls`/`messageType` through to `TriageThreadMessage`
  instead of collapsing them into a label (see the technical doc's
  "Phase 3 — Attachment rendering fix").

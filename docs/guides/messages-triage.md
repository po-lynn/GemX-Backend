# Messages Triage Inbox — Collaborator Guide

## Prerequisites

Normal dev setup — the page now reads real data, so you need a working
`DATABASE_URL` with some rows in the `messages` table (any local dev seed
data works). Visit `/admin/messages` while logged in as `admin` (or an
`internal` user with the `messages` or `chat_dashboard` permission).

Granting that permission: on `/admin/users/[id]` → Permissions tab, the
Communication section shows a single **Messages** toggle — flipping it
grants/revokes both the `messages` and `chat_dashboard` feature keys
together (see `featureSaveKeys()` in `features/rbac/feature-keys.ts`).
There's no separate "Chat Dashboard" toggle to manage independently
anymore, since both keys gate the same merged page.

## Using it end-to-end

1. Go to `/admin/messages`.
2. **Mode toggle** (top right of the page header) switches the middle list
   between "Conversations" (one row per thread) and "All messages" (one row
   per message — selecting one opens its parent thread in the reading pane).
3. **Filter rails** (left, 212px): STATUS and TYPE are independent filters
   that AND together — e.g. Status=Flagged + Type=Escrow shows only flagged
   escrow conversations. Counts update live based on the *other* rail's
   selection plus the current mode. **Awaiting reply** is real: it's true
   when a staff (admin/internal — e.g. the assigned escrow user) account is
   one of the two parties and the *other* party sent the most recent
   message, i.e. staff owes a response. A conversation with no staff
   participant at all (ordinary buyer↔seller chat) is never "awaiting" —
   nobody on staff is expected to reply there. Rows matching this also show
   a small purple dot on the avatar and an "Awaiting reply" pill directly in
   the list, so you don't have to open the filter to spot them. **Assigned
   to me**/**Resolved** still always show 0 — there's no schema backing
   those yet (see the technical doc's "Known gaps").
4. **Search** (top of the middle list) filters instantly across participant
   names, message body/preview, tag, and SKU (messages mode only).
5. **Sort toggle** (next to the result count) flips newest/oldest by
   timestamp.
6. Click a row to load it into the **reading pane** (right) — this fetches
   the real thread from `GET /api/admin/messages/thread`, showing a spinner
   while it loads and a retry card if it fails. The header shows both
   participants, message count, conversation type, and a thread number. A
   flagged thread shows an amber policy banner above the message scroller.
   Image attachments render as an inline thumbnail — click one to open it
   full-size in an overlay viewer (arrow keys / on-screen buttons to move
   between images if the message has more than one, Escape or the × to
   close). Non-image files render as a clickable "Attachment" link. A date
   pill appears above the first message of each calendar day the thread
   spans — not just once at the top — so it's always clear which day a
   given message is on.
7. **Flag** and **Delete** are real, persisted actions, but **only in
   "All messages" mode** — switch there first. In Conversations mode they
   still show a "Not wired yet in this preview" toast, since there's no
   single message those buttons could unambiguously act on there.
   - Flag toggles the message's real `starred` column and refreshes.
   - Delete opens a confirmation dialog, then hard-deletes the message on
     confirm (matches how delete already worked in the old Messages table
     view) and refreshes.
8. **REPLY** (above the INTERNAL note bar) is a real, persisted send: type a
   message and hit Send (or `⌘⏎`) to send it to whichever participant isn't
   you, as yourself — this is what lets a logged-in admin/internal account
   that's a party to the conversation (e.g. the assigned escrow-service
   user replying to a buyer or seller) actually respond from this page. It's
   disabled with an explanatory placeholder when you aren't one of the two
   participants — there'd be no unambiguous recipient to send to.
   - The paperclip button attaches one or more files (images, audio, PDF,
     or Word docs — up to 20MB each, 12 per reply). Picked files stage as
     removable chips above the input (image thumbnail or a generic file
     icon) — nothing uploads until you hit Send. You can send an attachment
     with no typed text at all.
   - Multiple images you attach together go out as one gallery message;
     each non-image file goes out as its own message. If you also typed a
     caption, only the first message sent carries it.
   - The Send button reads **"Uploading…"** while files are being uploaded,
     then **"Sending…"** while the message(s) are being saved.
9. Resolve / Export / New message / the `⋯` overflow button are still inert
   placeholders — clicking any of them shows the same toast. The **INTERNAL**
   note bar's input works but "Save" doesn't persist anything yet (that's a
   separate, still-unwired admin-only-notes feature — don't confuse it with
   REPLY above it).

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

**Extend the REPLY composer's attachment support (e.g. new file types, drag
and drop):** attachments upload via `POST /api/chat/media` — to allow a new
mime type, add it to *both* `ALLOWED_MEDIA_TYPES` in
`app/api/chat/media/route.ts` (the actual enforcement) and
`ALLOWED_ATTACHMENT_TYPES`/`ATTACH_ACCEPT` in `MessagesTriagePage.tsx`/
`ReadingPane.tsx` (the client-side pre-check + file-picker filter) — the two
must stay in sync or a file will be accepted client-side and then 400
server-side, or vice versa (rejected client-side even though the server
would have allowed it). There's no drag-and-drop or clipboard-paste attach
today, only the paperclip button's native file dialog — adding either means
wiring `onDrop`/`onPaste` handlers to call the same
`handlePickAttachments(fileList)` the file input already uses.

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

**Reuse the image viewer elsewhere:** `components/shared/ImageViewer.tsx` is
a shared component (also used by `ProductForm.tsx` and
`PortalProductForm.tsx` for product images) — `<ImageViewer images={string[]}
initialIndex={number} onClose={() => void} />`. To add click-to-enlarge
somewhere new: add a `viewer: { images: string[]; index: number } | null`
state, an `onClick={() => setViewer({ images, index: i })}` on the
thumbnail(s), and mount `{viewer && <ImageViewer .../>}` once at the end of
the component — see `ReadingPane.tsx` or `AdminAllConversationsView.tsx` for
the exact pattern. Don't add a fourth copy of the component itself.

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

- **"`<filename>`: unsupported file type" / "`<filename>`: file is larger
  than 20MB" toast when attaching a file** — expected client-side rejection,
  matching `POST /api/chat/media`'s real allow-list/size cap; the file was
  never uploaded. Not a bug — pick a supported type (images, audio, PDF,
  Word docs) under 20MB.
- **Reply with an attachment appears to "lose" the caption on one of the
  files** — expected when you attach both an image and a non-image file (or
  several non-image files) together: only the *first* message sent out of
  the batch carries your typed caption, since each `messages` row can only
  hold one attachment. See the technical doc's Phase 7 for why.
- **"Not wired yet in this preview" toast** — expected for Resolve/Export/
  New message/`⋯` everywhere, and for Flag/Delete specifically in
  Conversations mode. Not a bug — see "Known gaps" in the technical doc.
- **REPLY box shows "You're not a participant in this conversation" and
  won't let you type** — expected: the logged-in account has to be one of
  the two people in that specific conversation (e.g. the escrow-service
  user, or the buyer/seller) to send as themselves. A supervisor/oversight
  admin who's neither can view the thread but has no unambiguous recipient
  to reply as, so the composer disables itself rather than guess.
- **Escrow-service user can't even open `/admin/messages`** — separate from
  the above: they need the `messages` (or legacy `chat_dashboard`) RBAC
  permission granted on their account, and the account configured under
  Escrow Settings must have `role: internal` (or `admin`) — `internal` users
  with no messaging permission get redirected to `/admin` before ever
  seeing a conversation.
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

# Messages Triage Inbox

## What changed

`/admin/messages` and `/admin/chat-dashboard` merged into a single three-pane
triage inbox (filter rails · conversation/message list · reading pane),
matching `design_handoff_messages_triage/README.md` and `Messages Triage.dc.html`.

This landed in two phases:
1. **Static UI over mock data** — no API/DB wiring, no schema changes.
2. **Real data + Flag/Delete wiring** (this update) — the page now reads real
   conversations/messages from the database, the reading pane fetches real
   threads, and Flag/Delete are real, persisted actions. Resolve/Assign/Notes
   remain placeholders — see "Known gaps" below for why.

Files touched (phase 2, on top of phase 1's already-merged files):

- `features/messages/db/triage.ts` — **new**. `getTriageConversationsFromDb()`,
  `getTriageMessagesFromDb()`, and the temporary `classifyType()` heuristic
  (see "Schema impact"). `pairKey()`/`splitPairKey()` give conversations a
  stable id (`leastUserId:greatestUserId`) since conversations aren't a stored
  entity.
- `app/api/admin/messages/thread/route.ts` — **new**. `GET ?userA=&userB=`,
  backs the reading pane. Reuses `getConversationMessagesForAdmin` (the same
  query the old admin-only Chat Dashboard oversight view used) but is guarded
  differently — see "Auth & permissions".
- `features/chat/db/admin-all-conversations.ts` — additive only: added a
  `starred` field to `AdminConversationMessage` (and the query that populates
  it) so the reading pane can show the amber flagged-border/caption on real
  messages. No existing behavior changed for its other consumer
  (`/api/admin/chat/all-conversations/messages`).
- `lib/api-guard.ts` — added `requireAdminOrAnyFeature(request, featureKeys[])`,
  additive (existing `requireAdminOrFeature` untouched).
- `app/admin/messages/page.tsx` — now fetches `getTriageConversationsFromDb()`
  + `getTriageMessagesFromDb()` server-side and passes them as
  `initialConversations`/`initialMessages` props.
- `features/messages/components/triage/MessagesTriagePage.tsx` — takes those
  props instead of importing mock data; fetches the selected conversation's
  thread client-side on selection change; wires Flag/Delete to the real
  `setMessageStarredAction`/`deleteMessageAction` server actions (reused
  as-is from `features/messages/actions/messages.ts` — no changes needed
  there) with a confirmation dialog for Delete.
- `features/messages/components/triage/ReadingPane.tsx` — added
  `threadLoading`/`threadError`/`onRetryThread` (spinner + retry card, per
  the README's Loading/Errors section — deferred in phase 1 since mock data
  was synchronous) and `flagPending`/`deletePending` (disable buttons
  mid-request).
- `features/messages/mock/triage-fixtures.ts` — **deleted**. No longer
  referenced anywhere once the page moved to real data.
- `features/messages/lib/triage-filters.ts` — removed `getThreadFor` (mock
  thread lookup); `filterConversations`/`filterMessages`/`computeFacetCounts`/
  `sortByTimestamp` are unchanged and still operate generically on real data.

Still not deleted, still not routed to (unchanged from phase 1):
`features/messages/components/MessagesAdminPanel.tsx`,
`features/chat/components/AdminAllConversationsView.tsx`,
`features/chat/components/ChatDashboard.tsx`,
`features/chat/realtime/messages-realtime-service.ts`. The realtime
infrastructure is still the most likely starting point for a future reply
composer.

## Data flow (phase 2)

```
features/messages/db/triage.ts            (getTriageConversationsFromDb / getTriageMessagesFromDb — real Drizzle queries)
        │  (server component)
        ▼
app/admin/messages/page.tsx                fetches both, passes as props
        │
        ▼
MessagesTriagePage.tsx (client)             filters/sorts/facets the passed-in rows (same pure lib as phase 1);
        │                                    on selection change, fetches the thread client-side
        ▼
GET /api/admin/messages/thread              → getConversationMessagesForAdmin (features/chat/db/admin-all-conversations.ts)
        │
        ▼
ReadingPane.tsx                             renders thread, or a spinner/retry card while/if the fetch is in flight/failed

Flag/Delete (All-messages mode only):
MessagesTriagePage.tsx → setMessageStarredAction / deleteMessageAction (features/messages/actions/messages.ts, unchanged)
        → router.refresh() re-fetches the server component's initial props on success
```

State management (`mode`/`status`/`type`/`query`/`sortDesc`/`selectedId` in
the URL, selection-fallback effect, debounced-but-locally-instant search) is
unchanged from phase 1.

**Flag/Delete are only wired in "All messages" mode.** In "Conversations"
mode there's no single message these buttons could unambiguously act on — the
design shows per-message flag indicators inside the thread, not a
per-conversation flag concept, and README's own "Not Yet Designed" list
punts on bulk/thread-level actions. Clicking Flag/Delete in Conversations
mode still shows the `notWiredToast()` placeholder. Switch to All-messages
mode to flag/delete a specific message for real.

## Schema impact

**Still none.** No Drizzle schema changed, no migration generated — this
phase deliberately worked within the existing `messages` table (see prior
conversation: "wire Flag+Delete now, plan schema separately").

`getTriageConversationsFromDb()`/`getTriageMessagesFromDb()` populate
`flagged` from the real `starred` column, but `awaitingReply`/`assignedToMe`/
`resolved` are hardcoded `false` for every real row — there is still nothing
in the database backing those three statuses, so their rails always show 0
against real data. That's honest (not faked), not broken.

**`type` (chat/escrow/system) is a TEMPORARY heuristic** —
`classifyType()` in `features/messages/db/triage.ts`:
- body starting with "Escrow service request" (case-insensitive) → `escrow`
- else sender's role is `admin` → `system`
- else → `chat`

This was an explicit choice: the user wants a **real column set by the
message-send code path** long-term, not text-pattern inference — but that
requires finding/updating every place that sends an escrow-request or
system/Contact-Us message, which is real follow-up work, not done here.
"Contact Us" specifically has no path into the `messages` table at all today
— `contactMessage` (`drizzle/schema/contact-message-schema.ts`) is a
completely separate, unrelated table (anonymous website form submissions)
never linked to chat. Do not read the `classifyType` heuristic as the
intended long-term design.

## Auth & permissions

Unchanged from phase 1 for the page itself (`requireMessagesAccess()`, OR of
`messages`/`chat_dashboard`). New this phase:

- `GET /api/admin/messages/thread` uses **`requireAdminOrAnyFeature(request,
  [FEATURE_KEYS.MESSAGES, FEATURE_KEYS.CHAT_DASHBOARD])`** — deliberately
  *not* the existing `/api/admin/chat/all-conversations/messages` route,
  which is guarded by `requireStrictAdmin` (admin role only). Reusing that
  route as-is would have let a page-permitted internal-staff user load the
  list but 403 the moment they tried to open a thread. The new route reuses
  the same underlying query (`getConversationMessagesForAdmin`) with a
  matching-permission guard instead.
- Flag/Delete still go through `setMessageStarredAction`/`deleteMessageAction`,
  which independently check `canAdminManageUsers` (admin or internal, no
  per-feature check) inside the action itself — unchanged, reused as-is.

## Known gaps / TODOs

Carried over from phase 1 (still true): Resolve/Assign/Notes/Export/New
message/`⋯` are still `notWiredToast()` placeholders; no keyboard shortcuts;
`app/admin/messages/new/page.tsx` still unlinked; the 1500px-shell and
full-viewport-layout notes about deviating from the literal README spec.

New/updated this phase:

1. **Resolve/Assign/Notes have no schema to wire to yet** — this was a
   deliberate sequencing choice (do Flag/Delete now, since they already had
   real backing via `starred`/hard-delete; plan the rest as a separate
   schema effort). Needs new tables/columns for conversation resolution,
   assignment, internal notes, and an audit log — none exist today.
2. **`type` classification is a heuristic, not the intended final design**
   — see "Schema impact" above. Needs a real column set at send time.
3. **Flag/Delete are ambiguous in Conversations mode** and intentionally
   stay as placeholders there (see "Data flow" above).
4. **List isn't paginated** — `getTriageConversationsFromDb()` caps at 500
   rows. Fine for current volume; README explicitly flags this as needing
   real pagination/virtualization eventually.
5. Delete is a **hard delete** (reusing the existing `deleteMessageInDb`),
   not a soft-delete-with-audit-trail — matches how delete already worked
   elsewhere in this codebase (`MessagesAdminPanel.tsx`), but the README's
   "write an audit entry" note isn't satisfied since no audit log exists.

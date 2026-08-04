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

## Phase 3 — Attachment rendering fix

**Bug:** the reading pane rendered attachment messages as the bare label
string `"Attachment"`/`"Photo"`/`"Voice message"` with no image, audio
player, or link — the API (`GET /api/admin/messages/thread`) already
returned `fileUrl`/`imageUrls`/`messageType` per row, but
`MessagesTriagePage.tsx`'s `ThreadApiRow → TriageThreadMessage` mapping
collapsed them into a plain-text fallback before `ReadingPane.tsx` ever saw
the URL, and `TriageThreadMessage` (`types/triage.ts`) had no field to carry
one. The sibling `/admin/chat-dashboard` view
(`features/chat/components/AdminAllConversationsView.tsx`) kept the raw
fields through to render time already — but see Phase 3b below, it turned
out to have a *different*, more consequential bug in the same render logic.

**Fix:**
- `features/messages/types/triage.ts` — `TriageThreadMessage` now carries
  `fileUrl`, `imageUrls`, and `messageType` alongside `text` (which is now
  just `content`, not a synthesized label).
- `features/messages/components/triage/MessagesTriagePage.tsx` — the thread
  mapping passes `fileUrl`/`imageUrls`/`messageType` straight through instead
  of collapsing them.
- `features/messages/components/triage/ReadingPane.tsx` — the message bubble
  now mirrors `AdminAllConversationsView.tsx`'s render order: image gallery
  (`imageUrls`) → audio player (`messageType === "audio"` + `fileUrl`) →
  clickable `<a href={fileUrl}>Attachment</a>` (non-image file with no
  `content`) → text content.

No schema or API changes — the data was already there, only the client was
discarding it. Regression tests in
`tests/component/messages-triage-page.test.tsx` cover an image attachment
(renders an `<img>`, not "Photo") and a non-image file attachment (renders a
link to `fileUrl`, not a bare "Attachment" label).

## Phase 3b — Single-image messages still showed "Attachment"

**Bug:** Phase 3's fix still showed the bare "Attachment" link (not an
inline image) for real image messages in production. Confirmed against the
live `messages` table via PostgREST (local `DATABASE_URL` is a DB copy with
zero rows that have `file_url` set — see
[[reference_prod_db_access|prod DB access]] — so this needed a direct prod
read to catch): every real image message has `message_type: "image"` and
`file_url` pointing at the actual image, but **`image_urls` is `null`**.
`image_urls` is only populated for multi-image gallery sends (per the
schema comment on `chat-schema.ts`) — a single-image send (the common case)
never sets it. Both `ReadingPane.tsx`'s and
`AdminAllConversationsView.tsx`'s image-detection only checked
`imageUrls && imageUrls.length > 0`, so this majority case fell through to
the `fileUrl && !content` "Attachment"-link branch instead.

**Fix:** both components now resolve the image list as `imageUrls?.length >
0 ? imageUrls : (messageType === "image" && fileUrl) ? [fileUrl] : null`
before deciding what to render — a single-image message with only `fileUrl`
set now renders the same inline `<img>` a gallery message does.
`AdminAllConversationsView.tsx` got the identical fix even though it wasn't
what the user originally reported, since it has the exact same render
pattern and would hit the exact same real-world data shape.

Regression tests added: `tests/component/messages-triage-page.test.tsx`
("renders an image thumbnail when only fileUrl (not imageUrls) is set for
an image message") and a new `tests/component/admin-all-conversations-view.test.tsx`
covering the same case plus the non-image-attachment link for that view.

Verified live in-browser (Chrome DevTools MCP, see
[[feedback_ui_verification|UI verification approach]]): patched `window.fetch`
in the running dev app to return the exact real-data shape
(`imageUrls: null`, `fileUrl` set, `messageType: "image"`) and confirmed the
image now renders inline with zero console errors.

## Phase 3c — Click thumbnail to open full-size image viewer

**Ask:** the inline `<img>` thumbnail from Phase 3b is a small 96×96 crop
with no way to see the full image — clicking it did nothing.

**Fix:** rather than build a third viewer, extracted the existing
`ImageViewer` component — previously copy-pasted byte-for-byte identically
in `features/products/components/ProductForm.tsx` and
`components/portal/PortalProductForm.tsx` (full-screen overlay with
prev/next nav, thumbnail strip, Escape/arrow-key handling, focus management,
backed by the already-globally-loaded `.pd-viewer*` CSS in
`app/admin-list-view.css`) — into `components/shared/ImageViewer.tsx`. Both
original call sites now import the shared component instead of defining
their own copy; behavior is unchanged there (verified via
`tests/component/product-form-color-field.test.tsx` and
`product-form-nav.test.tsx`, which exercise `ProductForm.tsx`).

`features/messages/components/triage/ReadingPane.tsx` and
`features/chat/components/AdminAllConversationsView.tsx` each added local
`viewer: { images: string[]; index: number } | null` state; the thumbnail
`<img>` (or each thumbnail in a gallery message) gets an `onClick` that sets
it, and `<ImageViewer>` mounts conditionally at the end of the component.

**Test-environment note:** `ImageViewer` calls `scrollIntoView` in a
`useEffect` (to keep the active thumbnail visible in its strip), which jsdom
doesn't implement — added a no-op polyfill in `tests/setup-component.ts`
rather than mocking it per-test, since any component test that mounts
`ImageViewer` would otherwise throw.

Regression tests ("opens the image viewer when an attachment thumbnail is
clicked") added to both `tests/component/messages-triage-page.test.tsx` and
`tests/component/admin-all-conversations-view.test.tsx`. Verified live via
Chrome DevTools MCP: clicked the patched thumbnail, confirmed the full-size
overlay opens (counter, prev/next, thumbnail strip) with zero console
errors, then confirmed Escape closes it.

## Phase 3d — Date shown per day, not once for the whole thread

**Bug:** `ReadingPane.tsx` rendered exactly one date pill above the entire
message list, derived from only the *first* row returned by the API
(`MessagesTriagePage.tsx`'s `const dateLabel = rows[0] ? ... : ""`). Every
message below it showed only a time (`Gemx4 · 9:33 PM`), with no date at
all — so a thread spanning multiple days (common; conversations aren't
single-sitting) showed every later message under a date that might not be
theirs. `AdminAllConversationsView.tsx` had it worse: no date anywhere,
only per-message time.

**Fix:** removed the single `dateLabel` field from `TriageThread`
(`features/messages/types/triage.ts`) and its computation in
`MessagesTriagePage.tsx` entirely — a single label for a whole thread was
never the right shape. `ReadingPane.tsx` and `AdminAllConversationsView.tsx`
each now compute date dividers directly from the already-available
per-message timestamps: walking the message list, a divider renders above
the first message and above any message whose calendar day (`dayKey()`,
`new Date(iso).toDateString()`) differs from the previous message's.
Consecutive same-day messages share one divider, matching the original
single-pill visual style (same classes), just repeated per day instead of
once per thread.

Implementation note: switched each message-list `.map()` from an
expression body returning a single top-level element to a block body
returning `<Fragment key={m.id}>` wrapping an optional divider plus the
message — a `key`-bearing sibling pair per iteration needs an explicit
`Fragment`, `<>...</>` shorthand doesn't accept `key`.

Regression tests ("shows a date divider per calendar day in a thread
spanning multiple days") added to both test files, asserting: one divider
per distinct day, not one per message, and both day labels present when a
thread has messages on two different days. Verified live via Chrome
DevTools MCP with a patched 4-message/2-day thread — confirmed exactly two
dividers rendered in the right positions, zero console errors.

## Phase 4 — Feature permissions UI still showed two separate toggles

**Bug:** the Communication section of the internal-user "Feature
permissions" panel (`/admin/users/[id]`, permissions tab) still showed
**two** independent toggles — "Messages" and "Chat Dashboard" — even though
those pages were merged into one triage inbox back in the initial merge.
This wasn't just cosmetic: `FEATURE_GROUPS` (`features/rbac/feature-keys.ts`)
listed `messages` and `chat_dashboard` as two unrelated entries, and
`UserForm.tsx`'s save handler (`handleSave`) only wrote whichever keys were
present in `FEATURE_GROUPS` for that specific toggle. An admin who flipped
"Messages" off for a user who separately had `chat_dashboard: true` (e.g.
from before the merge) would see the toggle turn off, but the user kept
page access regardless — `requireMessagesAccess()`
(`features/messages/lib/require-messages-access.ts`) has always OR'd the two
keys together deliberately, so the stale `chat_dashboard` row silently kept
the door open. The permission the admin thought they revoked was still
effectively granted.

**Fix:** `features/rbac/feature-keys.ts` — collapsed the Communication
group to a single `{ key: MESSAGES, label: "Messages", aliasKeys:
[CHAT_DASHBOARD] }` entry (new `aliasKeys` field on `FeatureGroupItem`), and
added `featureSaveKeys(feature)` returning `[feature.key,
...(feature.aliasKeys ?? [])]`. `features/users/components/UserForm.tsx`
now goes through `featureSaveKeys` everywhere permissions are read or
written:
- `featureIsOn(feature, perms)` (new) reports a feature as "on" if *any* of
  its save keys is true, so a legacy split state (one key true, one false)
  still displays correctly instead of silently showing off.
- The checkbox `onChange`, `toggleGroup`, `enableAll`, and `clearAll` all
  write the same boolean to every key in `featureSaveKeys(feature)`, not
  just the primary key.
- `handleSave`'s `completePerms` is rebuilt from `featureIsOn` +
  `featureSaveKeys` for every feature, so **every save reconciles
  `messages`/`chat_dashboard` to the same value** — a legacy split
  permission self-heals the next time an admin touches that user's
  permissions, even if they don't touch the Communication row directly.

No schema or migration change — `chat_dashboard` remains a real,
independently-stored `internalPermission` row (kept for the reasons in
Phase-1's `requireMessagesAccess()` comment: nobody who had bare
`chat_dashboard` access loses it), it's just no longer independently
*editable* from the admin UI.

## Data flow (Phase 4 addendum)

```
FEATURE_GROUPS (feature-keys.ts)            Communication → one { key: messages, aliasKeys: [chat_dashboard] } entry
        │
        ▼
UserForm.tsx permissions tab                 featureIsOn() reads either key; toggle writes both via featureSaveKeys()
        │
        ▼
saveUserPermissionsAction → setUserPermissions   upserts both messages + chat_dashboard rows, always equal
        │
        ▼
requireMessagesAccess() (unchanged)          still ORs messages/chat_dashboard — now they can't drift apart via the UI
```

## Auth & permissions (Phase 4 addendum)

No change to who can access what at the guard layer — `requireMessagesAccess()`,
`requireAdminOrAnyFeature`, and the raw `chat_dashboard`-gated
`/api/admin/chat/presence` route are all untouched. This phase only changes
how the **admin-facing permission editor** represents and persists those two
keys, so a single visible toggle can no longer leave the two keys
inconsistent.

## Known gaps / TODOs (Phase 4 addendum)

- Existing users whose `messages`/`chat_dashboard` rows were already split
  before this change keep that split until an admin next saves their
  permissions (any save reconciles both — see "Fix" above). There's no
  proactive backfill migration; the reconciliation is lazy, on next edit.
- `FEATURE_ICONS` (`UserForm.tsx`) still has a `chat_dashboard` entry — it's
  unused now that the toggle only ever renders under the `messages` key,
  but left as-is since it's inert, not incorrect.

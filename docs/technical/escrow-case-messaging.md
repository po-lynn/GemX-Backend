# Escrow Case Messaging

## What changed and why

GemX coordinates escrow handovers (verifies the stone/identities, supervises
handover) but never holds funds — payment moves directly between buyer and
seller. This feature adds a dedicated 3-party (buyer + seller + assigned
agent) case thread, hung off a new `escrow_case` record, so staff can
supervise an escrow deal end-to-end instead of routing it through the
existing 1:1 `messages` table (which is strictly 2-party with no
conversation entity).

This is **Step 1+2+3+4+5 of a larger plan** — the minimum case model, its
messaging thread, its state machine, its side channel, and now attachments
and canned responses, all wired up end-to-end. Moderation/reports
(mute/ban, a reports queue, real server-side search) are still schema-ready
but not wired to any route — see "Edge cases & known limitations" below.

**Step 1** (`26bc962`): the schema, the state machine, the row-level access
guard, and the `staff_role` concept.
**Step 2** (`204ae24`): case listing/creation/detail, the messaging
endpoints, the admin UI, realtime broadcast, and push notifications.
**Step 3**: state transitions and agent assignment/reassignment, each
atomically paired with a system message and an audit log row; the EN/MY
system-message copy generator; the transition/reassign controls in the
admin UI.
**Step 4**: the `agent_buyer`/`agent_seller` side channel — an agent (or
supervisor/admin) messaging one party privately from within the case,
enforced in both the query and the notification fan-out, and independently
audit-logged.
**Step 5** (this change set): evidence attachments (photos, certificates,
payment slips) linked to the case independent of any one message, and
canned response templates (English + Burmese) with an admin config page
and a reply-box picker.

Files touched:

**Schema**
- `drizzle/schema/escrow-case-schema.ts` — `escrow_case`, `escrow_case_message`,
  `escrow_case_attachment`, `escrow_case_read_cursor` + their enums.
- `drizzle/schema/staff-role-schema.ts` — `staff_role` table + `staff_role_type` enum.
- `drizzle/schema/chat-moderation-schema.ts` — `messaging_restriction`,
  `message_report`, `escrow_chat_audit_log` (schema-only, reserved for a
  later step — see below).
- `drizzle/schema/escrow-canned-response-schema.ts` — `escrow_canned_response`
  (schema-only, reserved for a later step — see below).
- `drizzle/migrations/0099_sleepy_mathemanic.sql` — the generated migration
  for all of the above (see "Schema impact").

**Business logic / auth**
- `features/escrow-cases/lib/case-access.ts` — `requireEscrowCaseAccess()` /
  `requireEscrowThreadWriteAccess()`, the row-level scope resolver.
- `features/escrow-cases/lib/require-escrow-cases-access.ts` —
  page-level gate for `/admin/messages/escrow`.
- `features/escrow-cases/lib/state-machine.ts` — transition table
  (`canTransition`/`assertValidTransition`), now called from
  `transitionEscrowCaseState()`; added `getValidNextStates()` (Step 3) to
  drive the UI's transition picker.
- `features/escrow-cases/lib/system-message-copy.ts` — **new (Step 3)**,
  `buildSystemMessageCopy()` — pure EN/MY copy generator for
  `case_created`/`state_changed`/`assigned`/`reassigned` system messages.
- `features/escrow-cases/lib/money.ts` — integer-minor-unit helpers.
- `features/staff-roles/db/staff-roles.ts`,
  `features/staff-roles/actions/staff-roles.ts`,
  `features/staff-roles/schemas/staff-roles.ts` — the `staff_role`
  get/set/clear CRUD and its admin-only save action.

**Data + API + UI**
- `features/escrow-cases/db/escrow-cases.ts` — `listEscrowCasesForViewer()`,
  `getEscrowCaseDetail()` (now also returns `agentName`); `createEscrowCase()`
  **rewritten in Step 3** to run inside one `db.transaction` and post its own
  `case_created` system message (plus an `assigned` system message + audit
  row if an agent was chosen at creation time) — see "Data flow".
- `features/escrow-cases/db/case-transitions.ts` — **new (Step 3)**,
  `transitionEscrowCaseState()` / `setEscrowCaseAgent()`, each atomically
  pairing the state/assignment write with a system message and an audit log
  row inside one transaction.
- `features/escrow-cases/db/case-messages.ts` —
  `listEscrowCaseMessages()` **(Step 4: takes `includeSideChannel: boolean`,
  filters via `inArray` instead of a hardcoded `eq(visibility, "case")`)**,
  `sendEscrowCaseMessage()` **(Step 4: takes an optional `visibility`)**,
  `markEscrowCaseRead()`.
- `features/escrow-cases/types.ts` — client-side type mirror of the DB
  layer's shapes; `EscrowCaseDetail` gained `agentName` in Step 3;
  `EscrowCaseMessageVisibility` + `ESCROW_CASE_MESSAGE_VISIBILITY_LABELS`
  added in Step 4.
- `app/api/admin/escrow-cases/route.ts` — `GET` (list) / `POST` (create,
  now takes `actorId` for the audit trail).
- `app/api/admin/escrow-cases/[id]/route.ts` — `GET` (detail).
- `app/api/admin/escrow-cases/[id]/messages/route.ts` — `GET`
  (list messages, **Step 4:** passes `includeSideChannel = scope !==
  "moderation"`) / `POST` (send, **Step 4:** accepts `visibility`, writes a
  `side_channel_message_sent` audit row when it isn't `"case"`, and scopes
  the push notification's recipients to just the addressed party + agent).
- `app/api/admin/escrow-cases/[id]/read/route.ts` — `PATCH`
  (advance the caller's read cursor).
- `app/api/admin/escrow-cases/[id]/transition/route.ts` — **new (Step 3)**,
  `POST` (drive the state machine) — see
  [`docs/api/admin-escrow-cases-transition.md`](../api/admin-escrow-cases-transition.md).
- `app/api/admin/escrow-cases/[id]/assign/route.ts` — **new (Step 3)**,
  `POST` (assign/reassign, supervisor/admin only) — see
  [`docs/api/admin-escrow-cases-assign.md`](../api/admin-escrow-cases-assign.md).
- `app/admin/messages/escrow/page.tsx` — server page; now also computes and
  passes `canReassign` (Step 3).
- `features/escrow-cases/components/EscrowCaseInboxPage.tsx`,
  `EscrowCaseThreadView.tsx`, `NewEscrowCaseDialog.tsx` — client components;
  `EscrowCaseThreadView.tsx` gained the state-transition picker and
  "Reassign" button in Step 3, and the channel picker (Case / Private to
  buyer / Private to seller) + distinct amber side-channel bubble styling
  in Step 4. The channel resets to `"case"` on every case (re)load —
  `EscrowCaseInboxPage.tsx` never lets a stale private-channel selection
  carry over onto a newly selected case.
- `features/escrow-cases/components/ReassignCaseDialog.tsx` — **new (Step 3)**.
- `features/escrow-cases/actions/escrow-cases.ts` — server actions
  backing the New Case dialog's buyer/seller/listing/agent pickers (also
  reused by the Step 3 reassign dialog's agent picker).
- `lib/supabase/case-broadcast.ts` — realtime broadcast, sibling to
  `lib/supabase/chat-broadcast.ts`; `case_state_changed` events are now
  actually emitted (Step 3).
- `features/notifications/payloads/escrow-case.ts`,
  `features/notifications/services/escrow-case-notifications.ts` — FCM
  push for new case messages; gained
  `buildEscrowCaseStateChangeNotificationData()` /
  `sendEscrowCaseStateChangeNotification()` in Step 3 (buyer/seller only,
  not the agent — they're the one driving the change).
- `components/admin/AdminSidebar.tsx` — the "Escrow Cases" nav entry
  under Communication.
- `features/users/components/UserForm.tsx`,
  `app/admin/users/[id]/edit/page.tsx` — the "Staff role" section on
  the internal-user edit page (see "Auth & permissions").

**Step 5 additions**
- `lib/supabase/server.ts` — **new**, `ESCROW_EVIDENCE_BUCKET =
  "escrow-evidence"`, a dedicated Supabase Storage bucket separate from
  `CHAT_MEDIA_BUCKET`.
- `features/escrow-cases/db/case-attachments.ts` — **new**,
  `listEscrowCaseAttachments()`, `createEscrowCaseAttachment()`.
- `features/escrow-cases/db/canned-responses.ts` — **new**,
  `listEscrowCannedResponses()`, `createEscrowCannedResponse()`,
  `updateEscrowCannedResponse()`, `deleteEscrowCannedResponse()`.
- `app/api/admin/escrow-cases/[id]/attachments/route.ts` — **new**, `GET`
  (list evidence) / `POST` (upload one file to `escrow-evidence` +
  record it, `messageId: null`) — see
  [`docs/api/admin-escrow-cases-attachments.md`](../api/admin-escrow-cases-attachments.md).
- `app/api/admin/escrow-cases/[id]/messages/route.ts` — extended:
  `sendMessageSchema` now accepts `fileUrl`/`imageUrls` (max 1)/
  `attachmentType`, `content` is optional once one of those is present
  (matching `/api/chat/messages`'s own rule), and the route awaits an
  `escrow_case_attachment` insert (linked to the new message) whenever an
  attachment is present.
- `app/api/admin/escrow-canned-responses/route.ts`,
  `app/api/admin/escrow-canned-responses/[id]/route.ts` — **new**, full
  CRUD gated by `FEATURE_KEYS.ESCROW_CASES` (the same key as the case
  routes, not a separate settings key) — see
  [`docs/api/admin-escrow-canned-responses.md`](../api/admin-escrow-canned-responses.md)
  and
  [`docs/api/admin-escrow-canned-responses-detail.md`](../api/admin-escrow-canned-responses-detail.md).
- `app/admin/messages/escrow/canned-responses/page.tsx`,
  `features/escrow-cases/components/CannedResponsesAdminPage.tsx` —
  **new** admin config screen (list + create/edit dialog + active toggle +
  delete) — a self-contained component matching this feature's other
  dialogs, not the heavier `ListViewTable`/separate-page-per-action
  pattern other admin CRUD screens use (the entity is small and
  low-traffic).
- `features/escrow-cases/components/EscrowCaseThreadView.tsx` — gained a
  paperclip attachment picker (uploads via the existing generic
  `/api/chat/media`, then sends with `fileUrl`/`imageUrls`), a canned-
  response picker (inserts `bodyEn` into the reply box), inline
  image/file rendering in message bubbles, and an "Evidence (N)" toggle
  panel listing every `escrow_case_attachment` for the open case.
- `features/escrow-cases/components/EscrowCaseInboxPage.tsx` — owns the
  pending-attachment state (upload happens on send, not on pick),
  fetches canned responses once on mount and case attachments alongside
  case/messages on every case load, and adds a "Templates" link to the
  canned-responses admin page.
- `features/escrow-cases/types.ts` — added `EscrowCaseAttachment` and
  `EscrowCannedResponse` (client-facing mirrors of the new db-layer
  shapes).

## Data flow

**Inbox load → open a case**

```
features/escrow-cases/db/escrow-cases.ts   listEscrowCasesForViewer() — one raw SQL query
                                            joining escrow_case + buyer/seller user rows +
                                            product + latest case message + read cursor
        │  (server component)
        ▼
app/admin/messages/escrow/page.tsx         requireEscrowCasesAccess() gate → resolves
                                            assignedAgentId (self, unless admin/supervisor)
        │
        ▼
EscrowCaseInboxPage.tsx (client)           renders the case list (reuses ConversationList
                                            from Messages Triage); client-side substring
                                            search over buyer/seller/listing name only
        │  on row select
        ▼
GET /api/admin/escrow-cases/[id]           requireEscrowCaseAccess() row-level check
                                            → getEscrowCaseDetail()
GET /api/admin/escrow-cases/[id]/messages  requireEscrowCaseAccess() (any of the 4 scopes
                                            may read) → listEscrowCaseMessages()
        │
        ▼
EscrowCaseThreadView.tsx                   renders header (buyer↔seller, listing, price,
                                            state pill) + message bubbles/system pills
        │  fire-and-forget on open
        ▼
PATCH /api/admin/escrow-cases/[id]/read    markEscrowCaseRead() upserts the read cursor
                                            → broadcastCaseEvents("case_read_update")
```

**Case creation**

```
NewEscrowCaseDialog.tsx (client)     debounced pickers call server actions:
                                      searchUsersForEscrowCaseAction /
                                      searchListingsForEscrowCaseAction /
                                      getEscrowAgentOptionsAction
                                      (features/escrow-cases/actions/escrow-cases.ts —
                                      each independently re-checks feature-key access,
                                      since server actions bypass route middleware)
        │  on submit
        ▼
POST /api/admin/escrow-cases         requireAdminOrFeature(FEATURE_KEYS.ESCROW_CASES)
                                      → zod-validate body → reject buyerId === sellerId (400)
        │
        ▼
createEscrowCase()                   snapshots fee terms from the latest
                                      escrow_service_setting row (feeBps computed from its
                                      percent-string serviceFee; fee shares/min/cap copied
                                      as-is) → inserts escrow_case with state
                                      "agent_assigned" if an agent was chosen at creation,
                                      else "requested"
        │
        ▼
EscrowCaseInboxPage.tsx               onCreated(caseId) → refreshCases() re-fetches
                                       GET /api/admin/escrow-cases, selects the new case
```

**Sending a message (case thread or side channel)**

```
EscrowCaseThreadView.tsx (REPLY box +   onSendReply → POST /api/admin/escrow-cases/[id]/messages
channel picker: Case/Buyer/Seller)      { content, visibility }  — visibility omitted/"case"
        │                                unless the picker is set to agent_buyer/agent_seller
        ▼
requireEscrowThreadWriteAccess()      requireEscrowCaseAccess() + reject scope
                                       "moderation" (403) — same guard regardless of channel
        │
        ▼
sendEscrowCaseMessage()               inserts escrow_case_message
                                       (kind: "message", visibility as given, default "case")
        │
        ├──▶ broadcastCaseEvents(caseId, [{ event: "case_message_new", payload }])
        │      fire-and-forget → Supabase Realtime topic `case:<caseId>`
        │
        ├──▶ [Step 4, awaited] if visibility !== "case": INSERT escrow_chat_audit_log
        │      (actionType: "side_channel_message_sent", targetType: "case_message")
        │
        └──▶ sendEscrowCaseMessageNotification()
               fire-and-forget → FCM push, recipients scoped by visibility:
               "case" → buyer+seller+agent · "agent_buyer" → buyer+agent only ·
               "agent_seller" → seller+agent only (always minus the sender)
               → buildEscrowCaseMessageNotificationData() sets data.screen = "custom",
                 data.type = "escrow_case_message" (an old mobile build that doesn't
                 recognize the type still shows the OS banner)
```

**Reading a thread (moderation scope excludes the side channel)**

```
GET /api/admin/escrow-cases/[id]/messages   requireEscrowCaseAccess() resolves a scope
        │
        ▼
listEscrowCaseMessages(caseId,              includeSideChannel = access.scope !== "moderation"
  includeSideChannel)                       → WHERE visibility IN (...) via inArray:
                                             ["case"] for moderation, ["case","agent_buyer",
                                             "agent_seller"] for admin/supervisor/own
```

**Attaching evidence (Step 5)**

```
EscrowCaseThreadView.tsx (📎 button)   onPickAttachment(file) → held as client-side
                                        pendingAttachment state; NOT uploaded yet
        │  on Send
        ▼
POST /api/chat/media                   generic authenticated upload (session-only auth,
                                        same route the flat chat/triage composers use) →
                                        returns a public URL; NOT case-specific
        │
        ▼
POST /api/admin/escrow-cases/[id]/messages   { content?, fileUrl | imageUrls: [url],
                                                attachmentType, visibility }
        │
        ├──▶ sendEscrowCaseMessage()          inserts escrow_case_message with the file
        │
        └──▶ [awaited] createEscrowCaseAttachment({ caseId, messageId: saved.id, ... })
               → one escrow_case_attachment row, visible in the thread AND in the
                 case's independent "Evidence" panel

Separately, POST /api/admin/escrow-cases/[id]/attachments uploads straight to the
escrow-evidence bucket AND records the row in one request (messageId: null) — for
adding evidence that isn't part of any chat message. The two paths must never both
fire for the same file (would double-record it).
```

**Inserting a canned response (Step 5)**

```
EscrowCaseInboxPage.tsx (mount)   GET /api/admin/escrow-canned-responses (activeOnly
                                  default true) → cannedResponses state, fetched once
        │
        ▼
EscrowCaseThreadView.tsx          picker button lists titles; selecting one calls
                                  onInsertCannedResponse(bodyEn), which appends bodyEn
                                  into the existing reply textarea (client-side only —
                                  no server round-trip until the agent hits Send)
```

**Transitioning state**

```
EscrowCaseThreadView.tsx (state <select>)  onTransition(toState) — options come from
                                            getValidNextStates(caseDetail.state), which
                                            always excludes "agent_assigned"
        │
        ▼
POST /api/admin/escrow-cases/[id]/transition  requireEscrowThreadWriteAccess() — admin/
                                               supervisor/own may drive it, "moderation"
                                               scope is rejected (403)
        │
        ▼
transitionEscrowCaseState()   ONE db.transaction:
                               1. SELECT current state
                               2. assertValidTransition(current, toState) — throws
                                  EscrowCaseStateError (→ 409) if invalid; throws
                                  EscrowCaseInvalidRequestError (→ 400) up front if
                                  toState === "agent_assigned"
                               3. conditional UPDATE ... WHERE state = <state just read>
                                  — 0 rows updated → EscrowCaseConflictError (→ 409)
                               4. INSERT escrow_case_message (kind: "system",
                                  systemEventType: "state_changed")
                               5. INSERT escrow_chat_audit_log (actionType:
                                  "state_changed", before/afterState: {state})
        │
        ├──▶ broadcastCaseEvents(caseId, [{ event: "case_state_changed", ... }])
        └──▶ sendEscrowCaseStateChangeNotification({ recipientIds: [buyerId, sellerId] })
```

**Assigning / reassigning an agent**

```
EscrowCaseThreadView.tsx ("Reassign" button, shown only if canReassign)
        │  opens
        ▼
ReassignCaseDialog.tsx        agent list from getEscrowAgentOptionsAction()
        │  on confirm
        ▼
POST /api/admin/escrow-cases/[id]/assign   requireEscrowCaseAccess() then an EXTRA
                                            in-route check: only scope "admin" or
                                            "supervisor" may proceed (own/moderation → 403)
        │
        ▼
setEscrowCaseAgent()          ONE db.transaction:
                               1. SELECT current assignedAgentId + state
                               2. same agentId as current → EscrowCaseInvalidRequestError (400)
                               3. conditional UPDATE (agentId, and state → "agent_assigned"
                                  ONLY if this is a first assignment from "requested";
                                  a reassignment leaves state untouched)
                               4. INSERT system message ("assigned" or "reassigned")
                               5. INSERT audit row ("case_assigned" or "case_reassigned")
        │
        └──▶ broadcastCaseEvents(caseId, [{ event: "case_state_changed", ... }])
             (no push notification on assign/reassign — only on a state change)
```

## Schema impact

**New tables — `drizzle/schema/escrow-case-schema.ts`**

| Table | Key columns | Notes |
|---|---|---|
| `escrow_case` | `buyer_id`/`seller_id` (FK `user`, no `onDelete`), `listing_id` (FK `product`), `assigned_agent_id` (FK `user`, `SET NULL`), `state` (`escrow_case_state`, default `requested`), `state_entered_at`, `agreed_price_minor` (bigint), `currency`, `fee_bps`, `buyer_fee_share_bps`/`seller_fee_share_bps` (default 5000 = 50%), `fee_min_minor`/`fee_cap_minor` (nullable bigint), `next_action_note` | `buyer_id`/`seller_id` have no `onDelete` — a financial record with agreed price/fee terms must survive account deletion, unlike moderation-style records. Indexes on `(assigned_agent_id, state)`, `buyer_id`, `seller_id`, `listing_id`, `state_entered_at`. |
| `escrow_case_message` | `case_id` (FK `escrow_case`, `CASCADE`), `sender_id` (FK `user`, `SET NULL`, nullable for system rows), `kind` (`message`\|`system`), `visibility` (`case`\|`agent_buyer`\|`agent_seller`), `content`, `file_url`, `image_urls` (jsonb), `attachment_type` (reuses `messageTypeEnum` from `chat-schema.ts` under its own column name — that enum already means "attachment shape" elsewhere, `kind` carries authorship/purpose instead), `system_event_type` (`case_created`\|`state_changed`\|`assigned`\|`reassigned`, nullable), `system_event_payload` (jsonb) | No `editedAt` — case messages are immutable evidence, never edited. |
| `escrow_case_attachment` | `case_id` (`CASCADE`), `message_id` (nullable, `SET NULL` soft link), `uploaded_by_user_id` (`SET NULL`), `url`, `file_type`, `label` | Linked to the case, not only the message, so evidence survives if the originating message is ever removed. |
| `escrow_case_read_cursor` | composite PK `(case_id, user_id)`, `last_read_at` | Per-(case, viewer) "last read" cursor — a 3-party analog of the flat `messages` table's single `is_read` boolean. |

**New table — `drizzle/schema/staff-role-schema.ts`**

| Table | Key columns | Notes |
|---|---|---|
| `staff_role` | `user_id` (PK, FK `user`, `CASCADE`), `role` (`staff_role_type`: `escrow_agent`\|`moderator`\|`support`\|`analyst`), `is_supervisor` (bool, default `false`, meaningful only for `escrow_agent`) | A dedicated identity/assignment designation layered on `user.role = "internal"` — see "Auth & permissions". |

**`escrow_chat_audit_log` is now live (Step 3, extended in Step 4).** Every
state transition and every assign/reassign writes one row (`actorId`,
`actionType`, `targetType: "escrow_case"`, `targetId`, `before`/`afterState`,
optional `reason`) inside the same transaction as the underlying change.
**Step 4** adds a fourth writer: every side-channel message send writes a
row too (`actionType: "side_channel_message_sent"`, `targetType:
"case_message"`, `targetId`: the message id, `afterState: { visibility }`)
— awaited synchronously in the route, not fire-and-forget, since an
unaudited side-channel message would defeat the point of it being
independently auditable. There is still no reader for any of this (no
per-case/per-user audit trail UI), only writers.

**`escrow_case_attachment` and `escrow_canned_response` are now live
(Step 5).** `escrow_case_attachment` is written both by
`POST .../attachments` (`messageId: null`) and automatically by
`POST .../messages` whenever a message carries `fileUrl`/`imageUrls`
(`messageId`: the new message's id) — see "Data flow" below.
`escrow_canned_response` has full CRUD via
`/api/admin/escrow-canned-responses[/[id]]` and an admin config UI.

**Still schema-only, reserved for a later step** —
`drizzle/schema/chat-moderation-schema.ts`'s `messaging_restriction` and
`message_report` — fully defined, indexed, RLS-enabled tables with zero
references anywhere outside their own schema files (verified by grepping
the whole codebase for `messagingRestriction`, `messageReport`). They exist
so a later moderation/reports-queue step doesn't need its own schema-diff
pass.

**Migration**

Everything above lands in one generated migration:
`drizzle/migrations/0099_sleepy_mathemanic.sql`. It also adds four columns
to the pre-existing `escrow_service_setting` table —
`buyer_fee_share_bps`/`seller_fee_share_bps` (integer, default 5000) and
`fee_min_minor`/`fee_cap_minor` (nullable bigint) — the fee-sharing settings
`createEscrowCase()` snapshots at case-creation time.

**Enum naming: `staff_role` → `staff_role_type`**

`staffRoleEnum` is declared as the Postgres type `staff_role_type`, not
`staff_role`, even though it backs a table literally named `staff_role`.
Postgres automatically gives every table an implicit composite row type
sharing the table's name — so `CREATE TYPE staff_role AS ENUM(...)` would
collide with the implicit `staff_role` type created for the `staff_role`
table in the same schema. The established precedent for this split already
exists in this codebase: `product_status` (enum) vs. `product` (table). See
the comment at the top of `drizzle/schema/staff-role-schema.ts`.

## Auth & permissions

**`user.role` is untouched.** It stays `"admin" | "internal"` (unconstrained
free text, no DB enum since migration 0033). `staff_role` is a separate,
optional 1:1 designation layered on top, read via `getStaffRole(userId)`.

**Why `escrow_agent`/`moderator` are *not* new `user.role` values:** `role`
is checked by roughly 7 hardcoded call sites across the app
(`lib/api-guard.ts`, `lib/admin-guard.ts`, `proxy.ts`, etc.), and adding a
role value here was tried and reverted twice before (commits `35129e7`,
`8a78eec` — see the comment in `staff-role-schema.ts`). A `staff_role` row is
purely an identity/assignment concept; page and API access are still gated
by the existing `internal_permission` feature-key system. A user with no
`staff_role` row is "plain internal staff" — today's status quo, fully
backward compatible.

**Page gate** — `requireEscrowCasesAccess()`
(`features/escrow-cases/lib/require-escrow-cases-access.ts`): admin, or
internal + `FEATURE_KEYS.ESCROW_CASES` (`"escrow.cases"`). This only answers
"can this user open `/admin/messages/escrow` at all" — it does not check
`staff_role`.

**List/create API gate** — `GET`/`POST /api/admin/escrow-cases` both use
`requireAdminOrFeature(FEATURE_KEYS.ESCROW_CASES)`, the same key as the page
gate, with no `staff_role` check at that layer. Any internal user holding
the `ESCROW_CASES` key can call `POST` to create a case; on `GET`, scoping
to "only my own cases" (see below) happens inside the route, not the gate.

**Row-level per-case gate** — `requireEscrowCaseAccess()`
(`features/escrow-cases/lib/case-access.ts`) resolves one of four scopes for
one specific case, in order:

| Scope | Condition | Access |
|---|---|---|
| `admin` | `user.role === "admin"` | Full access to any case. |
| `supervisor` | `staff_role.role === "escrow_agent"` and `is_supervisor === true` | Full access to any case (reassignment, every agent's inbox). |
| `own` | `staff_role.role === "escrow_agent"` (not supervisor), **and** `case.assignedAgentId === session.user.id`, **and** the `ESCROW_CASES` feature key | Only that one assigned case. Both conditions are required — either failing is 403. |
| `moderation` | `staff_role.role === "moderator"` and the `CHAT_MODERATION` (`"chat.moderation"`) feature key | Read-only oversight of any case. |

Anyone matching none of the above gets 403.

`requireEscrowThreadWriteAccess()` = `requireEscrowCaseAccess()` plus
rejecting the `"moderation"` scope with 403. It guards `POST
.../messages` only — `GET .../messages` and `PATCH .../read` accept all
four scopes, since a moderator reading a thread, or marking their own read
cursor, doesn't touch anyone else's state.

**Known inconsistency — page gate vs. moderation scope.**
`requireEscrowCasesAccess()` (the page gate) checks only `ESCROW_CASES`, not
`CHAT_MODERATION`. A moderator granted only `CHAT_MODERATION` is redirected
away from `/admin/messages/escrow` before ever reaching the inbox UI, even
though `requireEscrowCaseAccess()` would grant them the `"moderation"` scope
on a specific case if they already had its id. `GET
/api/admin/escrow-cases` (the list endpoint) has the same gap — it is also
`ESCROW_CASES`-only, so a moderator has no listing endpoint to discover case
ids through today. In practice, a moderator needs both feature keys granted
to use anything here right now. This is flagged, not fixed — resolving it
is a product decision (should moderators get their own case-discovery view?)
out of scope for Step 1+2.

## Edge cases & known limitations

1. **Money is integer minor units, never float** —
   `features/escrow-cases/lib/money.ts`. `MINOR_UNIT_EXPONENT` is `USD: 2`,
   `MMK: 0` — MMK's "pya" subunit doesn't circulate in practice, so treating
   it like USD (exponent 2) would misrepresent every MMK case price by
   100x. Do not reuse `lib/formatters.ts`'s `formatPrice`/
   `formatPriceWithCurrency` here — those take major-unit floats straight
   into `Intl.NumberFormat`. `majorToMinor()`/`minorToMajor()` are the only
   sanctioned conversion path, and that convention must not leak backward
   into the general-purpose formatters either.
2. **Case creation is staff-initiated only.** `POST /api/admin/escrow-cases`
   is the only creation path, gated by the `ESCROW_CASES` feature key; there
   is no mobile-facing case-creation endpoint. Staff open a case from the
   admin panel after reviewing an initial buyer/seller contact made through
   the existing 1:1 chat.
3. **Reports/mute-ban schema exists but has no routes yet — reserved for a
   later step.** `message_report` and `messaging_restriction`
   (`drizzle/schema/chat-moderation-schema.ts`) are fully defined tables
   with zero code references outside their own schema files. The
   `"moderation"` access scope is enforced today (read-only thread and
   evidence oversight), but there is no reports queue and no mute/ban UI.
   (`escrow_chat_audit_log` and `escrow_canned_response` are no longer in
   this bucket — both are live as of Steps 3–5.)
4. **Search is a plain client-side substring filter, not server-side.**
   `EscrowCaseInboxPage.tsx`'s `filteredCases` runs `.filter()` over the
   buyer/seller name and listing title of whatever
   `listEscrowCasesForViewer()` already returned in full — there is no `?q=`
   query param and no `ILIKE`/index-backed search. The underlying SQL also
   has no `LIMIT`, so this is fine at current volume but won't scale past a
   few hundred cases for one viewer.
5. **State transitions are now live (Step 3), with two caveats.**
   `disputed` is modeled as a terminal state (`isTerminalState`/
   `getValidNextStates` return no outgoing transitions from it) — the brief
   doesn't specify whether a disputed case can later resume, so this is a
   conservative default that should be confirmed before anyone relies on
   it; resuming would need its own explicit rule in `state-machine.ts`, not
   an ad hoc exception in the route. Second, `transitionEscrowCaseState()`'s
   `reason` field is accepted and stored on the audit row, but no UI
   currently collects it — every transition made through
   `EscrowCaseThreadView.tsx`'s picker sends no reason.
6. **System messages are produced for `case_created`, `assigned`,
   `reassigned`, and `state_changed`** (Step 3) — `buildSystemMessageCopy()`
   renders the English string stored on `content`; the Burmese branch
   exists (`locale: "my"`) but is not yet reachable from any route, since
   there is no per-user locale to read (confirmed: `user` has no
   locale/language column) and no buyer/seller-facing surface renders this
   thread at all yet. The Burmese strings are a first-pass, static
   translation — not run through `lib/google-translate.ts` — and should get
   a native-speaker review before they ever reach a real buyer/seller.
7. **Side-channel visibility is live (Step 4), with one real limitation:
   there's no per-party (buyer vs. seller) reader distinction, because
   there's no buyer/seller reader at all.** `agent_buyer`/`agent_seller`
   messages are correctly withheld from the `"moderation"` scope's query
   and from the *other* party's push notification (an `agent_buyer` message
   never notifies the seller — not just hides content from them, hides the
   fact a message was sent at all). But `admin`/`supervisor`/`own` all see
   *both* side channels identically today — there's no staff-side concept
   of "you are the buyer" or "you are the seller" to filter by, since this
   whole API surface is admin/staff-only. A future buyer/seller-facing
   surface (mobile, out of scope here) is what would actually need to tell
   `agent_buyer` and `agent_seller` apart for a specific viewer.
8. **Page-gate vs. row-level scope mismatch for moderators** — see "Auth &
   permissions" above.
9. **Realtime broadcast and push notification are fire-and-forget, with no
   retry.** `broadcastCaseEvents()`/`sendEscrowCaseMessageNotification()`/
   `sendEscrowCaseStateChangeNotification()` are invoked as `void ...
   .catch(console.error)` — a failure only logs server-side and never
   surfaces to the caller or blocks the HTTP response. If
   `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are unset,
   `broadcastCaseEvents()` silently no-ops.
10. **No audit row for case creation itself.**
    `escrow_chat_audit_action` has no `"case_created"` value — only the
    `case_created` *system message* marks it. If an agent was chosen at
    creation time, that initial assignment **does** get a `case_assigned`
    audit row (`createEscrowCase()` writes one explicitly, since it can't
    call `setEscrowCaseAgent()` — the case doesn't exist yet). The case
    row's own `created_at`/the system message's `created_at` are the only
    record of "who created this and when" beyond that.
11. **No push notification on assign/reassign**, only on a state change —
    `setEscrowCaseAgent()`'s callers broadcast a realtime event but never
    call a notification service. A buyer/seller finds out their case was
    (re)assigned only by opening the thread (or via the next state-change
    push), not immediately.
12. **One attachment per message, no gallery.** `sendMessageSchema`'s
    `imageUrls` is capped at `min(1).max(1)` — deliberately narrower than
    the flat chat model's multi-image gallery support, to keep the
    composer's upload flow (and the case-attachment linkage) simple. An
    agent sharing multiple photos sends them as separate messages.
13. **No admin UI for `escrow_case_attachment` rows uploaded directly via
    `POST .../attachments`** (as opposed to attached to a message) —
    `EscrowCaseThreadView.tsx`'s attachment picker always goes through the
    message-send path (`POST .../messages` with `fileUrl`/`imageUrls`),
    which is what actually gets exercised today. The dedicated attachments
    endpoint works (verified directly via the API) and is what a future
    "add evidence without a message" action would call, but no UI drives
    it yet.
14. **Canned response management shares the `ESCROW_CASES` feature key**,
    not a separate settings permission — any internal user who can open
    the case inbox can also create/edit/delete templates via
    `/admin/messages/escrow/canned-responses`. If template editing should
    ever be admin-only, that page needs its own guard, not
    `requireEscrowCasesAccess()`.
15. **The Supabase Storage upload step could not be live-verified against
    the real `escrow-evidence` bucket in this environment** (outbound
    HTTPS to `*.supabase.co` timed out from the sandbox this was built in
    — a network restriction, not application code). What *was* verified
    directly against the real database: the message-with-attachment write
    path (an `escrow_case_message` row plus its linked
    `escrow_case_attachment` row, correct `fileType`/`messageId`) and the
    evidence list endpoint, using a `fileUrl` that doesn't require actual
    storage. The upload call itself reuses `requireUploadContext`/
    `validateUploadFile`/`uploadFileToBucket`
    (`lib/supabase/storage-upload.ts`) — the exact same helpers
    `/api/chat/media` already uses successfully in this codebase — pointed
    at the new `ESCROW_EVIDENCE_BUCKET` instead of `CHAT_MEDIA_BUCKET`.
    Confirm a real upload succeeds in an environment with outbound network
    access before relying on this in production.

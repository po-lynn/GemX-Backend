# Escrow Case Messaging

## What changed and why

GemX coordinates escrow handovers (verifies the stone/identities, supervises
handover) but never holds funds — payment moves directly between buyer and
seller. This feature adds a dedicated 3-party (buyer + seller + assigned
agent) case thread, hung off a new `escrow_case` record, so staff can
supervise an escrow deal end-to-end instead of routing it through the
existing 1:1 `messages` table (which is strictly 2-party with no
conversation entity).

This is **Step 1+2 of a larger plan** — the minimum case model plus its
messaging thread, not the full escrow operations console. State transitions
(verification → payment → handover → completed), moderation/reports, and
canned responses are schema-ready but not yet wired to any route — see
"Edge cases & known limitations" below.

**Step 1** (already committed, `26bc962`): the schema, the state machine, the
row-level access guard, and the `staff_role` concept.
**Step 2** (this change set): case listing/creation/detail, the messaging
endpoints, the admin UI, realtime broadcast, and push notifications.

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
- `features/escrow-cases/lib/require-escrow-cases-access.ts` — **new**,
  page-level gate for `/admin/messages/escrow`.
- `features/escrow-cases/lib/state-machine.ts` — transition table
  (`canTransition`/`assertValidTransition`); not called by any route yet.
- `features/escrow-cases/lib/money.ts` — **new**, integer-minor-unit helpers.
- `features/staff-roles/db/staff-roles.ts`,
  `features/staff-roles/actions/staff-roles.ts`,
  `features/staff-roles/schemas/staff-roles.ts` — the `staff_role`
  get/set/clear CRUD and its admin-only save action.

**Data + API + UI**
- `features/escrow-cases/db/escrow-cases.ts` — extended with
  `listEscrowCasesForViewer()`, `createEscrowCase()`, `getEscrowCaseDetail()`
  (`getEscrowCaseById()` already existed from Step 1).
- `features/escrow-cases/db/case-messages.ts` — **new**,
  `listEscrowCaseMessages()`, `sendEscrowCaseMessage()`, `markEscrowCaseRead()`.
- `features/escrow-cases/types.ts` — **new**, client-side type mirror of the
  DB layer's shapes.
- `app/api/admin/escrow-cases/route.ts` — **new**, `GET` (list) / `POST` (create).
- `app/api/admin/escrow-cases/[id]/route.ts` — **new**, `GET` (detail).
- `app/api/admin/escrow-cases/[id]/messages/route.ts` — **new**, `GET`
  (list messages) / `POST` (send).
- `app/api/admin/escrow-cases/[id]/read/route.ts` — **new**, `PATCH`
  (advance the caller's read cursor).
- `app/admin/messages/escrow/page.tsx` — **new** server page.
- `features/escrow-cases/components/EscrowCaseInboxPage.tsx`,
  `EscrowCaseThreadView.tsx`, `NewEscrowCaseDialog.tsx` — **new** client components.
- `features/escrow-cases/actions/escrow-cases.ts` — **new** server actions
  backing the New Case dialog's buyer/seller/listing/agent pickers.
- `lib/supabase/case-broadcast.ts` — **new**, realtime broadcast, sibling to
  `lib/supabase/chat-broadcast.ts`.
- `features/notifications/payloads/escrow-case.ts`,
  `features/notifications/services/escrow-case-notifications.ts` — **new**,
  FCM push payload/service for new case messages.
- `components/admin/AdminSidebar.tsx` — added the "Escrow Cases" nav entry
  under Communication.
- `features/users/components/UserForm.tsx`,
  `app/admin/users/[id]/edit/page.tsx` — added the "Staff role" section to
  the internal-user edit page (see "Auth & permissions").

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

**Sending a message**

```
EscrowCaseThreadView.tsx (REPLY box)  onSendReply → POST /api/admin/escrow-cases/[id]/messages
        │                             { content }
        ▼
requireEscrowThreadWriteAccess()      requireEscrowCaseAccess() + reject scope
                                       "moderation" (403)
        │
        ▼
sendEscrowCaseMessage()               inserts escrow_case_message
                                       (kind: "message", visibility: "case" — always today)
        │
        ├──▶ broadcastCaseEvents(caseId, [{ event: "case_message_new", payload }])
        │      fire-and-forget → Supabase Realtime topic `case:<caseId>`
        │
        └──▶ sendEscrowCaseMessageNotification()
               fire-and-forget → FCM push to buyer + seller + assignedAgent, minus sender
               → buildEscrowCaseMessageNotificationData() sets data.screen = "custom",
                 data.type = "escrow_case_message" (an old mobile build that doesn't
                 recognize the type still shows the OS banner)
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

**New tables — `drizzle/schema/chat-moderation-schema.ts` and `escrow-canned-response-schema.ts` — reserved for a later step**

`messaging_restriction`, `message_report`, `escrow_chat_audit_log`, and
`escrow_canned_response` are fully defined, indexed, RLS-enabled tables with
**zero references anywhere outside their own schema files** (verified by
grepping the whole codebase for `messagingRestriction`, `messageReport`,
`escrowChatAuditLog`, `escrowCannedResponse`) — no query, action, or route
reads or writes any of them yet. `escrow_case_attachment` (above) is in the
same state. They exist so a later moderation/canned-response/reports-queue
step doesn't need its own schema-diff pass; nothing in Step 1+2 is "using"
them.

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
3. **Moderation/reports/mute-ban schema exists but has no routes yet —
   reserved for a later step.** `message_report`, `messaging_restriction`,
   `escrow_chat_audit_log` (`drizzle/schema/chat-moderation-schema.ts`) and
   `escrow_canned_response` (`drizzle/schema/escrow-canned-response-schema.ts`)
   are fully defined tables with zero code references outside their own
   schema files. `escrow_case_attachment` is in the same state. The
   `"moderation"` access scope is enforced today (read-only thread
   oversight), but there is no reports queue, no mute/ban UI, and no
   canned-response picker.
4. **Search is a plain client-side substring filter, not server-side.**
   `EscrowCaseInboxPage.tsx`'s `filteredCases` runs `.filter()` over the
   buyer/seller name and listing title of whatever
   `listEscrowCasesForViewer()` already returned in full — there is no `?q=`
   query param and no `ILIKE`/index-backed search. The underlying SQL also
   has no `LIMIT`, so this is fine at current volume but won't scale past a
   few hundred cases for one viewer.
5. **No state-transition endpoint exists yet.**
   `features/escrow-cases/lib/state-machine.ts`'s `canTransition`/
   `assertValidTransition` are fully implemented and unit-tested
   (`tests/unit/escrow-case-state-machine.test.ts`) but are not called from
   any route or action. `createEscrowCase()` sets the initial state
   directly (`"agent_assigned"` if an agent was chosen at creation, else
   `"requested"`), bypassing the state machine since there's no prior state
   to transition from. Advancing a case through verification, payment,
   handover, or completion has no UI or API surface today.
6. **No system messages are ever produced.** `escrow_case_message.kind =
   "system"` and the `system_event_type`/`system_event_payload` columns
   exist, and `EscrowCaseThreadView.tsx` already renders a system row as a
   centered pill instead of a bubble — but `sendEscrowCaseMessage()`
   (`features/escrow-cases/db/case-messages.ts`) always inserts `kind:
   "message"`. Nothing in this change set inserts a system row (e.g. "Case
   created", "Agent reassigned") yet.
7. **Side-channel visibility is schema-only.**
   `escrow_case_message_visibility` has `agent_buyer`/`agent_seller` values
   in addition to `case`, but `listEscrowCaseMessages()` and
   `sendEscrowCaseMessage()` both hardcode `visibility: "case"` — see the
   doc comment at the top of `case-messages.ts`. There is currently no way
   to send or read a private agent↔buyer or agent↔seller message.
8. **Page-gate vs. row-level scope mismatch for moderators** — see "Auth &
   permissions" above.
9. **Realtime broadcast and push notification are fire-and-forget, with no
   retry.** `broadcastCaseEvents()`/`sendEscrowCaseMessageNotification()`
   are invoked as `void ... .catch(console.error)` in the messages route —
   a failure only logs server-side and never surfaces to the sender or
   blocks the HTTP response. If `NEXT_PUBLIC_SUPABASE_URL` or
   `SUPABASE_SERVICE_ROLE_KEY` are unset, `broadcastCaseEvents()` silently
   no-ops.

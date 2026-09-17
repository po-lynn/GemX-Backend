# Guide: escrow case messaging

## Prerequisites

- No new env vars or dependencies are required for the core feature.
  `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are only needed for
  the live realtime broadcast of new messages/read receipts
  (`lib/supabase/case-broadcast.ts`) — if they're unset, `broadcastCaseEvents()`
  silently no-ops and the page still works, it just won't update live without
  a manual refresh.
- A user with `role = "admin"` needs nothing else — they see and can post in
  every case.
- An **internal** user needs two separate things, both granted from the same
  place (Admin Panel → Users → open their edit page → **Permissions** tab —
  only visible/editable when *you* are logged in as `admin`, not another
  internal user):
  1. The **`Escrow Cases`** feature toggle (`FEATURE_KEYS.ESCROW_CASES` =
     `"escrow.cases"`), under the Communication group. This alone only
     answers "can this user open `/admin/messages/escrow` at all" —
     it does **not** let them see or send anything yet.
  2. A **staff role** of `escrow_agent`, set in the "Staff role" section
     further down the same Permissions tab (a plain dropdown + a "Supervisor"
     checkbox). Without this row, an internal user with only the feature
     toggle can open the inbox page but has no case-row access (every
     case fetch 403s).
     - Leave **Supervisor** unchecked for a normal agent — they'll only see
       cases assigned to them.
     - Check **Supervisor** to let this agent see and reassign *every*
       agent's cases (equivalent, for this feature, to admin).
     - A `moderator` staff role (+ the separate `Chat Moderation` /
       `chat.moderation` feature key) grants **read-only** oversight of every
       case thread instead — see "Common errors" below for what that
       actually blocks.

## Using it end-to-end

1. **Assign the staff role** (as an admin): Users → find the internal user →
   edit → Permissions tab → toggle on "Escrow Cases" → in the Staff role
   section pick "Escrow Agent" → Save.
2. **Open the inbox**: log in as that user and go to
   **Admin Panel → Communication → Escrow Cases**
   (`/admin/messages/escrow`). A plain agent sees only cases where they are
   `assignedAgentId`; a supervisor or admin sees every case, oldest-unread
   first.
3. **Create a case** — click **New Case**:
   - Search and pick a **Buyer** and a **Seller** (they must be different
     users) and a **Listing**.
   - Optionally pick an **Assigned agent** from the dropdown (only users
     holding the `escrow_agent` staff role appear here). Leaving it blank
     creates the case in `requested` state; picking one creates it directly
     in `agent_assigned`.
   - Enter the **Agreed price** as a normal decimal amount (e.g. `1500.00`)
     and pick **Currency**. The dialog converts this to integer minor units
     client-side before sending — you never type minor units yourself.
   - Click **Create case**. This sends:
     ```http
     POST /api/admin/escrow-cases
     Content-Type: application/json

     {
       "buyerId": "usr_buyer",
       "sellerId": "usr_seller",
       "listingId": "product-1",
       "assignedAgentId": "usr_agent",
       "agreedPriceMinor": 150000,
       "currency": "USD"
     }
     ```
     (`assignedAgentId` omitted entirely if left blank.) On success the new
     case is auto-selected in the inbox.
4. **Send a message** — with a case open, type in the **REPLY** box at the
   bottom and press Enter (or click Send). This sends:
   ```http
   POST /api/admin/escrow-cases/{id}/messages
   Content-Type: application/json

   { "content": "Handover is scheduled for Friday." }
   ```
   `content` must be 1–5000 characters. The message lands in the shared
   buyer+seller+agent thread immediately, and every other participant gets a
   push notification. Opening a case also silently calls
   `PATCH /api/admin/escrow-cases/{id}/read` in the background — this only
   advances *your own* read cursor and never affects anyone else's unread
   state.

## Extending it

- **Side-channel messages (agent↔buyer or agent↔seller only, hidden from the
  other party)**: the schema is already there —
  `escrow_case_message.visibility` (`drizzle/schema/escrow-case-schema.ts`)
  has `agent_buyer`/`agent_seller` values alongside `case`, but
  `listEscrowCaseMessages()`/`sendEscrowCaseMessage()`
  (`features/escrow-cases/db/case-messages.ts`) both currently hardcode
  `visibility: "case"` — see the doc comment at the top of that file for the
  exact 3-party visibility rule to implement. You'd add a `visibility`
  param to both functions and a way for the UI to pick a channel.
- **Canned responses**: `escrow_canned_response`
  (`drizzle/schema/escrow-canned-response-schema.ts`) is already a full,
  RLS-enabled table (`title`, `bodyEn`, `bodyMy`, `isActive`, `sortOrder`,
  `createdByAdminId`) with zero code referencing it yet. Build an admin CRUD
  for it plus a template picker above the REPLY box in
  `EscrowCaseThreadView.tsx` that fills the reply input from a selected row.
- **Reports / moderation queue**: `message_report`, `messaging_restriction`,
  and `escrow_chat_audit_log` (`drizzle/schema/chat-moderation-schema.ts`)
  are fully defined and indexed but have no routes yet.
  `message_report` already has the exactly-one-of
  `flatMessageId`/`caseMessageId` CHECK constraint wired so it can report
  either an escrow case message or a flat 1:1 chat message from the same
  table. Add a "Report" action in the thread view (inserts a `message_report`
  row), a queue page listing `status = 'open'` rows, and
  dismiss/action handlers that also write an `escrow_chat_audit_log` row.
- **State transitions**: `features/escrow-cases/lib/state-machine.ts`'s
  `canTransition()`/`assertValidTransition()` are implemented and unit
  tested (`tests/unit/escrow-case-state-machine.test.ts`) but nothing calls
  them yet. A future `PATCH /api/admin/escrow-cases/[id]/state` route would
  validate the transition, update `escrow_case.state`/`stateEnteredAt`, and
  insert a `kind: "system"` row (`systemEventType: "state_changed"`) so the
  thread shows it.
- **Mobile case creation**: there is no mobile-facing endpoint today —
  `POST /api/admin/escrow-cases` is staff-only. A mobile flow would reuse
  `createEscrowCase()` (`features/escrow-cases/db/escrow-cases.ts`) behind a
  new `/api/mobile/escrow-cases` route with its own auth/validation.

## Common errors

- **Redirected away from `/admin/messages/escrow` back to `/admin`**: the
  logged-in internal user doesn't hold the `escrow.cases` feature key. Grant
  it on their Permissions tab (see Prerequisites).
- **Page loads and shows the inbox, but every case (or a specific case)
  403s**: the user has no `staff_role` row at all, or has `escrow_agent` but
  isn't a supervisor and the case's `assignedAgentId` isn't them. Fix by
  either assigning them the staff role, making them a supervisor, or
  assigning that specific case to them.
- **`403 Forbidden` posting a message, but `GET`ing the same case's messages
  works fine**: the caller resolved to the read-only **`moderation`** scope
  (staff role `moderator` + the `chat.moderation` feature key).
  `requireEscrowThreadWriteAccess()` explicitly rejects that scope — a
  moderator gets full oversight of every case thread but can never post into
  one. If they need to actually participate, give them an `escrow_agent`
  staff role instead (a user can only hold one staff role at a time).
- **`400 { "error": "Buyer and seller must be different users" }`** creating
  a case: `buyerId` and `sellerId` were the same user. Pick two different
  people.
- **`400 { "error": "Invalid input" }`** creating a case or sending a
  message: something failed the Zod schema — most commonly
  `agreedPriceMinor` not a positive integer (check you converted major units
  correctly), `currency` not exactly `"USD"` or `"MMK"`, or a message
  `content` that's empty or over 5000 characters.
- **`404 { "error": "Not found" }`**: the case id in the URL doesn't exist.
  Cases are never soft- or hard-deleted by this feature today, so this
  usually means a typo'd/stale id.
- **Can't find a case you know exists**: the in-page search box only filters
  buyer name / seller name / listing title across the cases your own scope
  already returned (see the technical doc's "search is a plain client-side
  substring filter" note) — it can never surface a case outside your access
  scope, and there's no way to search by case id from the UI.
- **New messages/read receipts don't appear live, only after a manual
  refresh**: `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` aren't
  configured in this environment, so `broadcastCaseEvents()` is silently
  no-oping. Sending and receiving messages themselves are unaffected — only
  the live push update is missing.

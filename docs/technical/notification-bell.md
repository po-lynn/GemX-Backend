# Notification bell (nav bar)

## What changed

The nav bar bell in the admin panel (`components/admin/AdminNavbarClient.tsx`) was a static, non-functional placeholder. It now shows an unread badge and a dropdown list, with **two independent data sources depending on role**:

- **Internal staff** (`role === "internal"`) — personal-inbox unread count/list, based on `messages.isRead`/`recipientId` (existing chat semantics).
- **True admins** (`role === "admin"`) — system-wide "new since I last checked" count/list across every conversation in the system, since these users get the read-only oversight view (`AdminAllConversationsView`) rather than a personal inbox, and `messages.isRead` doesn't apply to conversations they aren't part of.

Files touched/added (this session, across two rounds):

- `features/chat/db/conversations-list.ts` — `getUnreadConversationPreviews(currentUserId, limit = 20)` (personal-inbox preview list).
- `app/api/chat/unread/preview/route.ts` — `GET`, wraps the above.
- `drizzle/schema/chat-schema.ts` — new `admin_chat_cursor` table (`userId` PK, `lastSeenAt`), migration `0070_confused_centennial.sql`.
- `features/chat/db/admin-all-conversations.ts` — added `getAdminChatLastSeenAt`, `markAdminChatSeen`, `getNewMessageCountForAdmin`, `getNewConversationsForAdmin`.
- `app/api/admin/chat/unread/route.ts`, `app/api/admin/chat/unread/preview/route.ts`, `app/api/admin/chat/seen/route.ts` — new `GET`/`GET`/`PATCH` routes, guarded by `requireStrictAdmin`.
- `features/chat/context/admin-chat-notification-context.tsx` — `fetchUnreadCounts` now branches on role to hit the right endpoint; exposes `isTrueAdmin` on the context; the polling/realtime gate was renamed from `isAdmin` to `canUseChatNotifications` and now also covers `role === "internal"` (previously only `role === "admin"` triggered the poll at all, which meant internal staff's own badge silently never populated — a pre-existing bug fixed as part of this change since it's the same gate this feature depends on).
- `components/admin/NotificationBell.tsx` — new client component (badge + popover list), renders one of two row shapes depending on `isTrueAdmin`.
- `components/admin/AdminNavbarClient.tsx` — swapped the placeholder `<button>` for `<NotificationBell />`.

## Schema impact

New table, no changes to existing tables:

```sql
CREATE TABLE "admin_chat_cursor" (
  "user_id" text PRIMARY KEY NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL
);
```

One row per admin, holding "the last time this admin opened the notification bell / oversight feed." Absence of a row (never opened it) is treated as the epoch (`new Date(0)`) so every message system-wide counts as new the first time.

## Data flow

**Internal staff (personal inbox), unchanged from the first round:**
1. Badge: `useAdminChatNotifications()` polls `GET /api/chat/unread` every 30s (+ realtime nudge via the `chat:<userId>` Supabase broadcast channel).
2. Dropdown: `NotificationBell` fetches `GET /api/chat/unread/preview` on open → `getUnreadConversationPreviews`.
3. Click-through: `/admin/chat-dashboard?peer=<userId>` (already supported server-side).

**True admins (system-wide oversight), new this round:**
1. Badge: same polling cadence, but hits `GET /api/admin/chat/unread` instead. That route reads the admin's cursor (`getAdminChatLastSeenAt`) then counts messages system-wide created after it, excluding the admin's own sent messages (`getNewMessageCountForAdmin` — `WHERE created_at > since AND sender_id != adminId`).
2. Dropdown: on open, `NotificationBell` fetches `GET /api/admin/chat/unread/preview` → `getNewConversationsForAdmin`, which reuses the same `DISTINCT ON (pair_key)` "latest message per conversation pair" shape as `getAllConversationsForAdmin`, filtered to pairs whose latest message is newer than the cursor and not sent by the admin.
3. **Mark-seen on open**: immediately after loading the preview list, `NotificationBell` calls `PATCH /api/admin/chat/seen` (→ `markAdminChatSeen`, an upsert of the cursor to `now()`), then calls `refreshUnread()` so the badge clears. The preview list itself was already fetched against the *old* cursor, so the admin still sees what was new — only the *next* poll reflects the reset.
4. Click-through: rows link to `/admin/chat-dashboard` (no `?peer=` — the oversight view has no per-pair deep link and the "peer" concept doesn't apply since the admin usually isn't one of the two participants).

## Auth & permissions

- `/api/chat/unread`, `/api/chat/unread/preview` — any authenticated session, scoped to the caller's own `recipientId`.
- `/api/admin/chat/unread`, `/api/admin/chat/unread/preview`, `/api/admin/chat/seen` — `requireStrictAdmin` (role === "admin" only, no internal/RBAC fallback), matching the existing `/api/admin/chat/all-conversations/messages` route.

## Edge cases & known limitations

- **No realtime for the system-wide count.** The `chat:<userId>` broadcast channel is scoped to messages addressed to that specific user, so it can't signal "a new message was sent between two other users" — the true-admin badge is polling-only (30s), consistent with the existing "no realtime updates" limitation already documented for the oversight feature (`docs/technical/admin-all-conversations.md`).
- **"Seen" is a coarse cursor, not per-message read state.** Opening the dropdown marks everything up to that moment as seen, even conversations the admin didn't actually click into — same tradeoff as most notification bells (GitHub, Slack, etc.), not a per-item read receipt.
- **No `?peer=` deep link for true admins.** `AdminAllConversationsView` doesn't accept a pre-selected pair; clicking a row takes the admin to the oversight list, not directly into that thread.
- **Self-triggered refetch guard.** `NotificationBell`'s effect refetches the list when `totalUnread` changes while open (so a new message during viewing shows up) — but marking seen itself changes `totalUnread`. A ref (`justMarkedSeenRef`) absorbs exactly that one self-caused re-run so the list doesn't flicker back to empty right after loading.
- Preview lists are capped at 20 items on both endpoints; no pagination in the dropdown ("View all conversations" link covers the rest).

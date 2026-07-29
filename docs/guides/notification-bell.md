# Notification bell

## Prerequisites

`DATABASE_URL` pointing at a Postgres with migration `0070_confused_centennial.sql` applied (adds the `admin_chat_cursor` table). Run `npm run db:migrate` if you're pulling this change for the first time. No new env vars.

## How it works

The bell in the admin nav bar (top right, next to the "Admin" menu) shows a badge and a dropdown list — what it shows depends on the logged-in user's role:

- **Internal staff** (`role === "internal"`): unread messages sent directly to them (their personal chat inbox). Clicking a row navigates to `/admin/chat-dashboard?peer=<userId>`, opening that conversation directly.
- **True admins** (`role === "admin"`): new conversations system-wide since they last opened the bell (they get the read-only "all conversations" oversight view instead of a personal inbox — see `docs/guides/admin-chat-oversight.md`). Opening the dropdown marks the feed as seen, so the badge clears once viewed. Rows link to `/admin/chat-dashboard` (no specific conversation pre-selected — see limitations below).

Both show: avatar(s), name(s), last message preview, relative time, and a static "View all conversations" link at the bottom.

## Using it in code

The badge/role info is available anywhere inside `app/admin/layout.tsx`:

```tsx
import { useAdminChatNotifications } from "@/features/chat/context/admin-chat-notification-context"

const { totalUnread, isTrueAdmin } = useAdminChatNotifications()
```

**Personal-inbox endpoints** (internal staff):

```bash
curl -b "<session-cookie>" http://localhost:3000/api/chat/unread/preview
```
```json
{
  "success": true,
  "conversations": [
    { "userId": "user_123", "name": "Jane Seller", "profileImage": null,
      "lastMessage": "Is this still available?", "lastMessageTime": "2026-07-29T04:12:00.000Z",
      "unreadCount": 2 }
  ]
}
```

**System-wide oversight endpoints** (true admins only — `requireStrictAdmin`):

```bash
curl -b "<admin-session-cookie>" http://localhost:3000/api/admin/chat/unread
# {"success":true,"total":3}

curl -b "<admin-session-cookie>" http://localhost:3000/api/admin/chat/unread/preview
# {"success":true,"conversations":[{"participants":[{...},{...}],"lastMessage":"...","lastMessageTime":"...","lastMessageType":"text"}]}

curl -X PATCH -b "<admin-session-cookie>" http://localhost:3000/api/admin/chat/seen
# {"success":true}  — marks the feed seen as of now, clearing the badge on the next poll
```

Or call the query functions directly from server code:

```ts
import {
  getUnreadConversationPreviews,   // personal inbox — features/chat/db/conversations-list.ts
} from "@/features/chat/db/conversations-list"

import {
  getAdminChatLastSeenAt,
  getNewMessageCountForAdmin,
  getNewConversationsForAdmin,
  markAdminChatSeen,
} from "@/features/chat/db/admin-all-conversations"
```

## Extending it

- **Change how many conversations show**: pass a different `limit` to `getUnreadConversationPreviews` / `getNewConversationsForAdmin` (both default to 20).
- **Support true-admin deep links**: `AdminAllConversationsView` doesn't currently accept a `?peer=`/pair to pre-select a conversation. To support it, thread a query param through `app/admin/chat-dashboard/page.tsx` into `AdminAllConversationsView` and call its existing `selectConversation` on mount when it matches a row.
- **Per-message read state for oversight** (instead of a single "seen as of X" cursor): would need a new junction table (e.g. `admin_message_seen(adminId, messageId)`), a much heavier change — the current cursor approach was chosen because oversight has no notion of "the recipient," so nothing simpler already existed to piggyback on.

## Common errors

- **True-admin badge stuck non-zero after opening the dropdown**: check the browser console/network tab for the `PATCH /api/admin/chat/seen` call — if it 403s, the session's role isn't exactly `"admin"` (internal staff don't have a cursor to mark).
- **Internal staff's badge never updates**: confirm you're inside `app/admin/layout.tsx` (the `AdminChatNotificationProvider` only wraps that subtree) and that the session role is `"internal"` or `"admin"` — the poll/realtime effects are gated by `canUseChatNotifications` in `admin-chat-notification-context.tsx`.
- **Dropdown shows "Unknown user"**: the peer's `user` row wasn't found (e.g. deleted account) — both preview queries fall back to that label rather than erroring.
- **401 vs 403**: 401 means no session at all; 403 from an `/api/admin/chat/*` route means the session is valid but not role `"admin"`.

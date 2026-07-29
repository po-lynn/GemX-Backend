# Notification bell

## Prerequisites

None beyond what's already required for the chat feature (`DATABASE_URL`, a running Postgres with the `messages` table). No new env vars, no new migration.

## How it works

The bell in the admin nav bar (top right, next to the "Admin" menu) shows a red badge with the number of unread messages sent directly to the logged-in user. Clicking it opens a dropdown with:

- One row per peer with unread messages: avatar, name, last message preview, relative time, and that peer's unread count.
- A "View all conversations" link to `/admin/chat-dashboard`.

Clicking a row navigates to `/admin/chat-dashboard?peer=<userId>`, which opens that conversation directly (for internal staff using the personal-inbox chat dashboard).

## Using it in code

The badge count is available anywhere inside `app/admin/layout.tsx` via the existing hook:

```tsx
import { useAdminChatNotifications } from "@/features/chat/context/admin-chat-notification-context"

const { totalUnread } = useAdminChatNotifications()
```

The dropdown's data comes from a dedicated endpoint:

```bash
curl -b "<session-cookie>" http://localhost:3000/api/chat/unread/preview
```

```json
{
  "success": true,
  "conversations": [
    {
      "userId": "user_123",
      "name": "Jane Seller",
      "profileImage": null,
      "lastMessage": "Is this still available?",
      "lastMessageTime": "2026-07-29T04:12:00.000Z",
      "unreadCount": 2
    }
  ]
}
```

Or call the query directly from server code:

```ts
import { getUnreadConversationPreviews } from "@/features/chat/db/conversations-list"

const previews = await getUnreadConversationPreviews(userId, /* limit */ 20)
```

## Extending it

- **Change how many conversations show in the dropdown**: pass a different `limit` to `getUnreadConversationPreviews` (default 20), or thread a query param through `/api/chat/unread/preview` if you want it configurable per-request.
- **Add unsend/mark-as-read from the dropdown**: the route is read-only today; you'd add a `POST`/`PATCH` action and call it from `NotificationBell.tsx`, then call `refreshUnread()` (from `useAdminChatNotifications()`) to update the badge immediately.
- **Support true-admin deep links**: `AdminAllConversationsView` doesn't currently accept a `?peer=` to pre-select a conversation. To support it, thread `searchParams.peer` from `app/admin/chat-dashboard/page.tsx` into `AdminAllConversationsView` as an `initialPeer` prop and call its existing `selectConversation` on mount when it matches a row.

## Common errors

- **Badge never updates**: confirm you're inside `app/admin/layout.tsx` (the `AdminChatNotificationProvider` only wraps that subtree) and that the logged-in user's role passes the `isAdmin` check in `admin-chat-notification-context.tsx` — the poll/realtime effects are gated on `role === "admin"`.
- **Dropdown shows "Unknown user"**: the peer's `user` row wasn't found (e.g. deleted account) — `getUnreadConversationPreviews` falls back to that label rather than erroring.
- **401 from `/api/chat/unread/preview`**: no valid session — same auth requirement as the rest of `/api/chat/*`.

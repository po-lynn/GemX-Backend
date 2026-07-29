# Notification bell (nav bar)

## What changed

The nav bar bell in the admin panel (`components/admin/AdminNavbarClient.tsx`) was a static, non-functional placeholder. It now shows an unread-message badge and a dropdown listing the conversations with unread messages.

Files touched/added:

- `features/chat/db/conversations-list.ts` — added `getUnreadConversationPreviews(currentUserId, limit = 20)`.
- `app/api/chat/unread/preview/route.ts` — new `GET` route wrapping that query.
- `components/admin/NotificationBell.tsx` — new client component (badge + popover list).
- `components/admin/AdminNavbarClient.tsx` — swapped the placeholder `<button>` for `<NotificationBell />`.

No schema changes and no new migration — the feature is built entirely on the existing `messages.isRead` column (`drizzle/schema/chat-schema.ts`).

## Data flow

1. **Badge count**: `NotificationBell` reads `totalUnread` from the existing `useAdminChatNotifications()` context (`features/chat/context/admin-chat-notification-context.tsx`), which already polls `/api/chat/unread` every 30s and refreshes on Supabase realtime `messages` events. This was already wired into the admin layout (`AdminChatNotificationProvider` wraps `app/admin/layout.tsx`) but nothing consumed it in the nav bar until now.
2. **Dropdown list**: on open, `NotificationBell` fetches `GET /api/chat/unread/preview`, which calls `getUnreadConversationPreviews(session.user.id)`. This runs one `DISTINCT ON (sender_id)` query (latest unread message per peer) plus two follow-up queries (peer profiles, per-peer unread counts) — mirroring the shape of `getChatConversationsForUser`, but scoped to `is_read = false` and without the presence (online/offline) lookup, since the dropdown doesn't need it.
3. **Click-through**: each row links to `/admin/chat-dashboard?peer=<userId>`. That query param was already supported server-side by `app/admin/chat-dashboard/page.tsx` for the personal-inbox view (`role === "internal"` staff) — no changes were needed there. For `role === "admin"` users, the page instead renders `AdminAllConversationsView` (the separate system-wide oversight feature), which does not read `?peer=`; clicking a notification as a true admin lands on the oversight list rather than a pre-selected thread. See "Known limitations" below.

## Auth & permissions

`/api/chat/unread/preview` requires only a valid Better Auth session (`auth.api.getSession`) — no role check, matching the existing `/api/chat/unread` route. It returns only the calling user's own unread messages (`recipient_id = session.user.id`), so there is no cross-user data exposure.

## Edge cases & known limitations

- The badge/preview reflect messages sent **directly to** the current user (`messages.recipientId`). This is the same "personal inbox" unread concept used by `ChatDashboard`'s sidebar — it is unrelated to the separate admin-oversight "all conversations" feature, which has no unread concept (see `docs/technical/admin-all-conversations.md`).
- For `role === "admin"` users, `/admin/chat-dashboard` renders the oversight view, which ignores `?peer=`. A notification row for an admin who has direct messages will navigate there but not auto-select the conversation. Fixing this would mean adding peer deep-linking to `AdminAllConversationsView`, out of scope for this change.
- The dropdown list is fetched fresh every time it's opened (and again if `totalUnread` changes while open) — there's no client-side caching between opens.
- Preview list is capped at 20 conversations (`limit` param, default in `getUnreadConversationPreviews`); no pagination/"load more" in the dropdown itself (there's a static "View all conversations" link at the bottom instead).

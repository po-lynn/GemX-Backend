# Guide: admin chat oversight view

## Prerequisites

- No new env vars or dependencies.
- You need a user with `role = "admin"` in the `user` table to see this view (internal
  staff with the `chat_dashboard` RBAC permission still see the original personal-inbox
  Chat Dashboard, unchanged).

## Using it

1. Log in as a user with `role = "admin"`.
2. Go to **Admin Panel → Communication → Chat Dashboard**.
3. The left panel lists every 1:1 conversation in the system, most recently active
   first — both participants' names/avatars and a preview of the last message.
4. Use the search box to filter the currently loaded page by participant name.
5. Click a conversation to load its full message history in the right panel.
   This is **read-only** — there's no message box. If you need to actually chat with
   someone, that's not what this view is for.
6. Use Prev/Next (or the page numbers) at the bottom of the sidebar to page through
   older conversations — this reloads the page with `?page=N`.

## Extending it

- **Add a filter (e.g. by date range or user role)**: extend
  `getAllConversationsForAdmin` in `features/chat/db/admin-all-conversations.ts` with
  extra `WHERE` clauses, and thread the new query params through
  `app/admin/chat-dashboard/page.tsx` → `<AdminAllConversationsView>`.
- **Add real-time updates**: this view intentionally has none. If you want it, look at
  how `ChatDashboard` (`features/chat/components/ChatDashboard.tsx`) subscribes to
  Supabase `postgres_changes` on `messages`, and reuse the same channel setup —
  but keep in mind this view isn't scoped to one user, so the subscription filter
  can't be `user_id=in.(...)` the way the personal inbox's is.
- **Let admins jump into a conversation as themselves**: not supported by this view.
  You'd want a separate action (e.g. a button that opens `/admin/chat-dashboard` in
  the *personal* inbox mode with `?peer=<id>`) rather than adding a composer here,
  since threads between two other users have no "me" to send as.

## Common errors

- **"Forbidden" (403) hitting `/api/admin/chat/all-conversations/messages` directly**:
  this endpoint requires `role === "admin"` exactly — internal users with the
  `chat_dashboard` permission are rejected here even though they can open the page
  (they just get the personal inbox instead, which uses `/api/chat/history`).
- **A conversation doesn't show up**: the list only includes pairs that have at least
  one row in `messages`. A conversation with zero messages doesn't exist yet.
- **Attachments don't look right**: images/audio/files render as plain tags here, not
  the richer gallery/lightbox UI from the personal inbox — this view deliberately
  doesn't share code with `ChatDashboard`.

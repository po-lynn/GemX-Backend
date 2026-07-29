# Admin: all-conversations oversight view

## What changed

Previously, `/admin/chat-dashboard` scoped its sidebar to conversations the *viewing*
user was personally part of (`getChatPeerProfilesForUser(session.user.id)`), for every
role that could reach the page — including `role === "admin"`. A true admin could not
see a conversation unless they happened to be sender or recipient, so e.g. the
"Website Contact Form" thread (routed to whichever single account is configured in
`escrow_service_setting`) was invisible to every other admin.

For `role === "admin"` specifically, the page now renders a read-only, system-wide
oversight view instead of the personal inbox. Internal staff with the `chat_dashboard`
RBAC permission are unaffected — they still get the original personal-inbox
`ChatDashboard` component.

Files touched:
- `app/admin/chat-dashboard/page.tsx` — branches on `session.user.role === "admin"`.
- `features/chat/db/admin-all-conversations.ts` (new) — system-wide conversation queries.
- `features/chat/components/AdminAllConversationsView.tsx` (new) — read-only client UI.
- `app/api/admin/chat/all-conversations/messages/route.ts` (new) — thread fetch endpoint.
- `lib/api-guard.ts` — added `requireStrictAdmin` (role === "admin" only, no RBAC fallback).

## Data flow

1. **List** (server-rendered, no API round trip): `page.tsx` calls
   `getAllConversationsForAdmin(page, pageSize)` and `getAllConversationsCount()`
   directly from the Server Component, then passes the page of rows to
   `<AdminAllConversationsView>`.
2. **Thread** (client-fetched on selection): clicking a row calls
   `GET /api/admin/chat/all-conversations/messages?userA=&userB=&page=&limit=`, which
   calls `getConversationMessagesForAdmin(userA, userB, page, limit)`.

### `getAllConversationsForAdmin`

One row per **conversation pair**, not per message. A pair is any two user ids that
have exchanged at least one `messages` row, collapsed regardless of who sent to whom:

```sql
pair_key = LEAST(sender_id, recipient_id) || ':' || GREATEST(sender_id, recipient_id)
```

Uses the same `DISTINCT ON (pair_key) ... ORDER BY pair_key, created_at DESC` shape as
`getChatConversationsForUser` (`features/chat/db/conversations-list.ts`) to pick the
latest message per pair in one index-friendly pass, then a single `IN (...)` query
resolves both participants' profiles for every row on the page.

Pagination is real (`LIMIT`/`OFFSET` in SQL), not client-side slicing — unlike
`/admin/messages` (`features/messages/db/messages.ts`), which loads every message row
and paginates in memory. Conversation *pairs* are bounded by `C(users, 2)`, far fewer
than raw messages, but real pagination avoids relying on that bound holding forever.

### `getConversationMessagesForAdmin`

Same `sender = A AND recipient = B) OR (sender = B AND recipient = A)` shape as
`/api/chat/history`, except neither `A` nor `B` needs to be the caller — the whole
point of the oversight view is browsing conversations the admin isn't part of.

## Auth

- Page: `requireFeatureAccess(FEATURE_KEYS.CHAT_DASHBOARD)` (unchanged) gates entry to
  the page at all — admin unconditionally, or internal with the RBAC permission.
- New API route: `requireStrictAdmin` — **`role === "admin"` only**, no internal/RBAC
  fallback. An internal user with `chat_dashboard` access can still open the page (they
  get the personal inbox), but cannot call this endpoint even by hand-crafting the
  request, since it exposes arbitrary users' full message content.

## Read-only by design

The all-conversations view has no message composer, no realtime subscription, and no
send/edit/delete/star actions — it's an oversight tool, not a second inbox. This was a
deliberate scope decision: threads not involving the admin can't be replied to "as"
someone else without spoofing a sender, so the simplest and safest contract is
view-only for every thread shown here, including the admin's own.

## Known limitations

- No search/filter on the server side — the sidebar search box only filters
  participant names within the currently loaded page (same limitation the existing
  `ChatDashboard` sidebar search already has).
- No realtime updates; the list and thread are fetched once per page load / selection.
- Attachments render as raw `<img>`/`<audio>` tags without the lightbox/gallery
  behavior `ChatDashboard` has, since this view intentionally doesn't share code with
  it (kept small and isolated instead of retrofitting the ~2000-line existing
  component to a second data model).

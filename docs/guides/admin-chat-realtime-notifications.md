# Admin chat realtime notifications

## Overview

When a mobile user sends a message to an admin (`recipient_id` = admin user id):

1. Row is inserted in PostgreSQL `messages`
2. Supabase Realtime fires `INSERT` (table must have replication enabled)
3. Admin UI updates without refresh

## Components

| Piece | Path |
|-------|------|
| Realtime service | `features/chat/realtime/messages-realtime-service.ts` |
| Global provider | `features/chat/context/admin-chat-notification-context.tsx` |
| Chat UI | `features/chat/components/ChatDashboard.tsx` |
| Sidebar badge | `components/admin/AdminSidebar.tsx` |

## Env

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Enable **Realtime** for `public.messages` in Supabase Dashboard.

## Browser notifications

On first admin visit, the app requests notification permission. Popups are suppressed when the admin has that conversation open (`PUT /api/chat/viewing` heartbeat from Chat Dashboard).

## Mobile

Users send via `POST /api/chat/messages` with `recipientId` = admin user id. Register FCM separately for background mobile push.

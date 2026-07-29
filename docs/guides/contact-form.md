# Contact us form — Collaborator Guide

## Prerequisites

- No new env vars or dependencies — uses the existing DB connection, `lib/rate-limit.ts`, and the existing chat/notification/broadcast services.
- Migration `drizzle/migrations/0069_short_thaddeus_ross.sql` must be applied (`npm run db:migrate`).
- `scripts/create-contact-system-user.sql` must be run once per environment (`psql "$DATABASE_URL" -f scripts/create-contact-system-user.sql`) — creates the placeholder "Website Contact Form" chat-sender account. Safe to re-run (`ON CONFLICT (id) DO NOTHING`).
- An escrow officer must be assigned in **Admin → Settings → Escrow Service** for chat delivery to have somewhere to go — otherwise submissions are still saved but nothing shows up in any chat inbox.

## Using the feature end-to-end

1. Visit the landing page and scroll to `#contact` (or click "Contact us" in the navbar/footer).
2. Fill in name, email, and message, then click **Send message**.
3. `ContactSection.tsx` posts to `POST /api/contact`; on success it clears the form and shows an inline confirmation, on failure it shows the error inline (no toast/redirect).
4. The submission lands in the `contact_message` table with `status: "pending"` (always — this is the durable record), and:
   - If an escrow officer is assigned, it also appears as a new chat message from **"Website Contact Form"** in that officer's **Admin → Chat Dashboard**, in realtime, same as any buyer/seller chat.
   - To inspect stored submissions directly (e.g. if you need the raw list, not just what's in chat):
     ```bash
     npm run db:studio
     # or
     psql "$DATABASE_URL" -c "select name, email, message, created_at from contact_message order by created_at desc limit 20;"
     ```

## Extending the feature

**Add an admin inbox page** for `contact_message` (view/mark-reviewed submissions, independent of chat):
1. Add DB queries under `features/contact/db/contact-message.ts` (list paginated by `created_at desc`, update `status`).
2. Add an admin route `app/api/admin/contact-messages/route.ts` (session + role check, mirror `app/api/admin/collector-piece-show-requests/route.ts`).
3. Add an admin page under `app/admin/` and a sidebar entry in `components/admin/AdminSidebar.tsx`.

**Add email notification in addition to chat delivery**: introduce an email-sending dependency (e.g. Resend) and call it from `app/api/contact/route.ts` alongside `deliverToEscrowOfficerChat()`; add the new env var (e.g. `RESEND_API_KEY`) to `.env.example`.

**Change who receives the chat message**: it's always whoever is currently assigned as the escrow officer (`getEscrowServiceChatUser()` in `features/escrow-service-settings/db/escrow-service-settings.ts`). To route to someone else instead/also (e.g. a dedicated "support" role), swap or extend the resolver called from `deliverToEscrowOfficerChat()` in `app/api/contact/route.ts`.

**Add a new form field** (e.g. phone number):
1. Add the column to `drizzle/schema/contact-message-schema.ts`, run `npm run db:generate` + `db:migrate`.
2. Add it to `bodySchema` in `app/api/contact/route.ts` and the `.values({...})` insert.
3. Add the controlled input + state in `components/home/ContactSection.tsx`.

## Common errors

- **"Too many requests" (`429`)**: the in-memory rate limiter (`lib/rate-limit.ts`) caps 5 submissions/60s per IP. Wait a minute, or raise the limit in `app/api/contact/route.ts` if this is too strict for testing.
- **`400` with a validation message**: one of `name`/`email`/`message` failed Zod validation (empty, invalid email format, or over the max length) — the message returned is the first Zod issue's message.
- **Submission succeeds (`200`) but no chat message appears**: check that an escrow officer is assigned in **Admin → Settings → Escrow Service** — `deliverToEscrowOfficerChat()` silently no-ops if `escrow_service_setting.user_id` is null. Also confirm `scripts/create-contact-system-user.sql` was run in this environment; if the placeholder account row is missing, the chat insert still "succeeds" (no FK on `messages.senderId`) but the message will show as sent by an unresolvable/"Unknown user" sender.
- **Officer doesn't see it live, only after refresh**: realtime delivery depends on `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` being set — `broadcastChatEvents()` silently no-ops without them (same as the rest of the chat feature), but the message is still in the DB and will show on next load.

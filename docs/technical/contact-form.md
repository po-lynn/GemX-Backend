# Contact us form

## What changed

Wired up the previously-static "Contact us" section on the landing page (`#contact`) — the form had no `onSubmit` and its button was `type="button"` with no handler.

- `drizzle/schema/contact-message-schema.ts` — new `contact_message` table
- `drizzle/schema.ts` — export added
- `drizzle/migrations/0069_short_thaddeus_ross.sql` — migration, applied
- `app/api/contact/route.ts` — public `POST /api/contact`
- `components/home/ContactSection.tsx` — converted to a client component with form state and submit handling
- `scripts/create-contact-system-user.sql` — one-time SQL to create the placeholder chat-sender account, applied
- `features/contact/constants.ts` — `CONTACT_SYSTEM_USER_ID`, the placeholder account's `user.id`

## Data flow

1. Visitor fills the form in `ContactSection.tsx` (controlled inputs: `name`, `email`, `message`).
2. On submit, the component `POST`s JSON to `/api/contact` and shows an inline success or error message based on the response — no page reload.
3. The route rate-limits by client IP (`x-forwarded-for`, 5 req/60s via `lib/rate-limit.ts`), validates the body with a Zod schema, then inserts one row into `contact_message` with `status: "pending"`. This insert is the durable record of the submission and always happens regardless of what follows.
4. `deliverToEscrowOfficerChat()` then resolves the currently assigned escrow officer via `getEscrowServiceChatUser()` (`features/escrow-service-settings/db/escrow-service-settings.ts`, reads `escrow_service_setting.user_id` — the same "Assign officer" dropdown in **Admin → Settings → Escrow Service**). If one is configured, it inserts a `messages` row addressed to that officer, `senderId` set to the placeholder `CONTACT_SYSTEM_USER_ID` account, with the visitor's name/email/message folded into `content`. It then fires the same push notification (`sendChatMessageNotification`) and Supabase Realtime broadcast (`broadcastChatEvents`) that `app/api/chat/messages/route.ts` uses, so the submission shows up in the officer's Chat Dashboard exactly like a normal buyer/seller message, live.
5. `deliverToEscrowOfficerChat()` is entirely best-effort — every step is wrapped so a failure (no officer configured, DB error, push/broadcast failure) is caught and logged, never thrown. The contact submission always succeeds from the visitor's perspective as long as the `contact_message` insert succeeded; chat delivery is a bonus, not a dependency.

## Schema

`contact_message`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | `defaultRandom()` |
| `name` | text, not null | |
| `email` | text, not null | not validated as unique/FK — anonymous submitter |
| `message` | text, not null | |
| `status` | text, not null, default `pending` | workflow: `pending` \| `reviewed` \| `dismissed` (extensible, unused by any UI yet) |
| `created_at` | timestamp, not null, default now | |

Indexes on `created_at` and `status` for a future admin listing/filter view.

Migration generated with `npm run db:generate` and applied with `npm run db:migrate`.

## The placeholder chat-sender account

Every row in `messages` needs a real `user.id` sender — the chat system has no anonymous/system-sender concept. `scripts/create-contact-system-user.sql` creates one persistent row for this purpose:

| Column | Value | Why |
|---|---|---|
| `id` | `sys-website-contact-form` | fixed, referenced by `CONTACT_SYSTEM_USER_ID` |
| `name` | `Website Contact Form` | shown as the sender name in the officer's chat |
| `role` | `user` | lowest privilege — never matches any admin/internal/portal check |
| `archived` | `true` | hides it from the default admin Users list and the "New chat" directory (`getUsersPaginatedFromDb` with no `view` defaults to `archived = false`); does **not** hide it from the officer's existing conversation list, since `getChatPeerProfilesForUser`/`getChatConversationsForUser` don't filter on `archived` |
| `banned` | `true` | defense-in-depth against Better Auth session creation |
| *(no `account` row)* | — | the real login-blocker — no password/OAuth credential exists, so Better Auth has nothing to authenticate against regardless of `banned` |

This script must be run once per environment (`psql "$DATABASE_URL" -f scripts/create-contact-system-user.sql`, idempotent via `ON CONFLICT (id) DO NOTHING`) — it is not part of the Drizzle migration chain since it's a data seed, not a schema change, matching the convention of other one-off scripts in `scripts/`.

## Auth & permissions

- `POST /api/contact` is fully public — no session or bearer check, matching the form's anonymous-visitor use case.
- Abuse mitigation is IP-based rate limiting only (in-memory, per server instance — resets on deploy/restart, same tradeoff as the other public endpoints using `lib/rate-limit.ts`).
- The escrow officer replies to the visitor by email (the visitor's email is in the message content) — replying in-chat would only reach the placeholder account, which nobody monitors.

## Edge cases & known limitations

- **Chat delivery requires an escrow officer to be configured.** If `escrow_service_setting.user_id` is null (nobody assigned in **Admin → Settings → Escrow Service**), `deliverToEscrowOfficerChat()` is a no-op — the submission is still saved to `contact_message`, just not surfaced anywhere proactively.
- **No email notification.** The codebase has no email-sending integration (Resend/Nodemailer/etc.); chat delivery was chosen instead, reusing the existing escrow-officer chat channel.
- **`searchUsersForPicker`** (`features/users/db/users.ts`, used by a few unrelated admin dialogs — premium dealer activation, point purchase requests) does not filter `archived`, so the placeholder account could theoretically surface there. Low-risk (an admin would have to deliberately search for it by name), left as-is rather than adding a filter for an edge case outside this feature's scope.
- **In-memory rate limit is per-instance.** On multi-instance deployments, the effective limit is `5 * instanceCount` req/min per IP, not a hard global cap — acceptable for a low-traffic contact form, same as existing public routes (`push/global/subscribe`, `mobile/register`).
- **No spam/bot protection beyond rate limiting** (no CAPTCHA, no honeypot field) — acceptable for now given the low-value target (no account creation, no payment), though each spam submission now also produces a chat message to the officer.

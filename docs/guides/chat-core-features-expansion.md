# Guide: chat core features expansion

Covers five additions to the chat backend: escrow-case thread pagination and send
rate-limiting, full-text message search, self-service block/unblock, and a mobile
"report this message" endpoint. See the linked technical docs for design rationale;
this guide is about using and extending each feature.

## Prerequisites

- No new env vars.
- Run migrations before using blocking or search locally:

  ```bash
  npm run db:migrate
  ```

  This applies `0101_open_mathemanic.sql` (`chat_block` table) and
  `0102_chat_message_search_index.sql` (the `messages` full-text GIN index).

## Using it end-to-end

### Case-thread pagination

```bash
curl "http://localhost:3000/api/admin/escrow-cases/<caseId>/messages?page=2&limit=25" \
  -H "Cookie: better-auth.session_token=<session-cookie>"
```

Omit `page`/`limit` for the default (`page=1, limit=50`) — the same "most recent page,
oldest→newest within it" convention as `GET /api/chat/history`. `total` in the response
tells you how many pages exist (`Math.ceil(total / limit)`).

### Case-thread send rate limit

No client changes needed — `POST /api/admin/escrow-cases/[id]/messages` now returns
`429` (`Too many messages — please slow down`) if the caller sends more than 30 case
messages in 60 seconds, and `503` with `Retry-After: 3` if the rate-limit check itself
times out. Handle both the same way your client already handles the flat chat send
path's identical responses.

### Message search

```bash
curl "http://localhost:3000/api/chat/search?q=sapphire&page=1&limit=30" \
  -H "Cookie: better-auth.session_token=<session-cookie>"
```

Add `&peerId=<userId>` to scope the search to one conversation instead of all of the
caller's chats. `q` must be at least 2 characters.

### Block / unblock

```bash
# Block someone
curl -X POST "http://localhost:3000/api/chat/blocks" \
  -H "Cookie: better-auth.session_token=<session-cookie>" -H "Content-Type: application/json" \
  -d '{"userId":"<peerId>","reason":"harassment"}'

# List who you've blocked
curl "http://localhost:3000/api/chat/blocks" -H "Cookie: better-auth.session_token=<session-cookie>"

# Unblock
curl -X DELETE "http://localhost:3000/api/chat/blocks/<peerId>" \
  -H "Cookie: better-auth.session_token=<session-cookie>"
```

Once blocked (in either direction), `POST /api/chat/messages` returns `403` for either
party, and the thread disappears from both `GET /api/chat/conversations` and
`GET /api/chat/unread/preview` for both users. Old messages remain visible via
`GET /api/chat/history` — blocking doesn't delete history.

### Report a message

```bash
curl -X POST "http://localhost:3000/api/chat/messages/<messageId>/report" \
  -H "Cookie: better-auth.session_token=<session-cookie>" -H "Content-Type: application/json" \
  -d '{"reason":"spam"}'
```

Only the message's sender or recipient can file this. Filing it again returns the
existing report (`alreadyReported: true`) instead of creating a duplicate. Filed
reports show up in the existing admin queue, `GET /api/admin/chat-moderation/reports`
— nothing new to build there.

## Extending it

- **Wire pagination into the admin case-thread UI:** `EscrowCaseInboxPage.tsx`
  currently calls the messages route with no query params (so it silently gets
  `page=1, limit=50`). To support scrolling to older messages, add a "load older"
  control that increments `page` and prepends the results.
- **Add a per-case rate limit** instead of the current global-per-sender one: in
  `app/api/admin/escrow-cases/[id]/messages/route.ts`, add `eq(escrowCaseMessage.caseId, id)`
  to the rate-limit count's `WHERE` clause.
- **Add search to escrow-case threads** if a buyer/seller-facing case surface is ever
  built: follow the same `to_tsvector`/GIN-index pattern in
  `features/chat/db/message-search.ts`, targeting `escrow_case_message.content` instead.
- **Add a "mute" alongside "block"** (notification-suppression without a hard send
  block): would need a second boolean/table distinct from `chat_block`, since blocking
  today always both suppresses sends *and* hides the conversation — the two behaviors
  aren't split.
- **Rate-limit report filing** if it's abused: copy the DB-counted sliding-window
  pattern from `app/api/chat/messages/route.ts` into
  `app/api/chat/messages/[messageId]/report/route.ts`, counting `message_report` rows
  by `reporterId`.

## Common errors

| Symptom | Cause | Fix |
|---|---|---|
| `GET /api/admin/escrow-cases/[id]/messages` returns fewer messages than expected | Default `limit=50` now applies where the endpoint used to load everything | Pass `?limit=200` (the max) or paginate with `page` |
| `POST /api/chat/messages` returns `403 You can't message this user` | Either party has an active block | Call `DELETE /api/chat/blocks/<peerId>` if you're the blocker, or ask the other party to unblock |
| `POST /api/chat/blocks` with your own user id returns `400` | Self-block isn't allowed | No-op by design — nothing to fix |
| `GET /api/chat/search` returns `400` | `q` missing or under 2 characters | Debounce client-side search input until `q.length >= 2` |
| `POST /api/chat/messages/[messageId]/report` returns `404` | Caller isn't the message's sender or recipient, or the message doesn't exist | Only participants of a message can report it — this is intentional, not a bug |
| `npm run db:generate` after adding a new index-only migration reports "No schema changes" | Expected — index-only migrations (FTS GIN indexes) aren't declared in the Drizzle schema DSL, so `db:generate` never sees them; they're written and journaled by hand (see `docs/technical/chat-message-search.md`) | Nothing to fix; write the SQL file directly and add its entry to `drizzle/migrations/meta/_journal.json` |

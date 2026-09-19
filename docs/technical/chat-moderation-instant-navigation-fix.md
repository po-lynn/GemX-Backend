# Chat moderation page: Instant Navigation prerendering fix

## What changed

`app/admin/messages/moderation/page.tsx` was throwing at request time in Next.js 16:

```
Route "/admin/messages/moderation": Next.js encountered uncached data during
prerendering or a navigation.
```

The page's body called `await requireChatModerationAccess()` directly, with no
`<Suspense>` boundary above it and no opt-out of Instant Navigation validation.
`requireChatModerationAccess` (`features/chat-moderation/lib/require-chat-moderation-access.ts`)
calls `auth.api.getSession({ headers: await headers() })`, which is uncached, session-derived
data — Cache Components refuses to let that reach the static shell.

Fix, in `app/admin/messages/moderation/page.tsx`:

```ts
import { connection } from "next/server"

export const instant = false

export default async function AdminChatModerationPage() {
  await connection()
  await requireChatModerationAccess()
  // ...
}
```

This mirrors the existing pattern in the two sibling pages under `app/admin/messages/`:
`escrow/page.tsx` and `page.tsx` (the messages triage page), both of which already had
`await connection()` + `export const instant = false` for the same reason — a
session-gated admin page can never be part of a static shell, so it opts out of
validation instead of chasing a Suspense boundary that wouldn't help.

## Why `connection()` + `instant = false` and not a Suspense boundary

The dev-overlay error offers three fixes: stream (Suspense), cache (`"use cache"`), or
block (`instant = false`). Streaming doesn't apply here — the access check itself decides
whether the page renders at all (it can `redirect()`), so it can't be pushed into a child
Suspense boundary below the page shell. Caching doesn't apply either — the session must be
re-checked on every request, not memoized. `instant = false` is the documented opt-out for
exactly this shape of route (see `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md`,
"Opting out").

## Data flow

No data flow change — `requireChatModerationAccess()` still does the same thing (checks
`auth.api.getSession`, then admin/`CHAT_MODERATION`-permission gate, else redirects). The
only change is *when* Next.js is told this route is allowed to block.

## Auth & permissions

Unchanged: admin session, or internal staff with `FEATURE_KEYS.CHAT_MODERATION` via
`checkInternalAccess`. See `features/chat-moderation/lib/require-chat-moderation-access.ts`.

## Files touched

- `app/admin/messages/moderation/page.tsx` — added `connection()` call and `instant = false`.
- `tests/unit/admin-chat-moderation-page-instant.test.ts` — new regression test asserting
  the page exports `instant === false` and calls `connection()` before the access check.
- `tests/unit/require-chat-moderation-access.test.ts` — new unit test for the access guard
  itself (previously untested), mirroring `tests/unit/require-messages-access.test.ts`.

## Edge cases & known limitations

- `require-escrow-cases-access.ts`'s guard (used by `escrow/page.tsx`) also has no unit
  test yet — out of scope here, but the same gap.
- Opting a route out of Instant Navigation validation with `instant = false` doesn't make
  navigations into it slower than they already were; it just stops the dev overlay from
  flagging it. The route was always going to block on the server for a fresh session
  check regardless of this flag.

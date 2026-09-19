# Guide: opting a session-gated admin page out of Instant Navigation

## Prerequisites

- No new env vars or dependencies. Applies to any Next.js 16 App Router page under
  `app/admin/` (Cache Components is enabled for this project).

## When you need this

You'll hit this the moment you add a new `app/admin/**/page.tsx` whose body calls an
access guard like `requireChatModerationAccess()`, `requireEscrowCasesAccess()`, or
`requireMessagesAccess()` — any guard that reads `auth.api.getSession()` — directly at
the top of the page component. On `npm run dev`, Next.js will throw:

```
Route "/admin/..." : Next.js encountered uncached data during prerendering or a
navigation.
```

This happens because the session check is uncached, request-specific data read outside
any `<Suspense>` boundary, which blocks the route from ever joining a static shell.

## How to fix it

Add both of these to the page file (do **not** add just one — `instant = false` alone
silences the dev overlay's error, but `connection()` is what actually declares the
route as dynamic so React doesn't try to prerender past that point):

```tsx
import { connection } from "next/server"

// Feature-access check requires the signed-in session on every load, so this page can
// never be part of a static shell — opt out of Instant Navigation validation.
export const instant = false

export default async function YourAdminPage() {
  await connection()
  const session = await requireYourFeatureAccess()
  // ... rest of the page
}
```

Working examples already in this codebase:
- `app/admin/messages/escrow/page.tsx`
- `app/admin/messages/page.tsx`
- `app/admin/messages/moderation/page.tsx`
- `app/admin/queue/page.tsx` (referenced by the others' comments as the original instance)

## Extending it

- **Adding a new session-gated admin page**: copy the two lines above verbatim, right
  before the access-guard call. Don't try to solve it with a `<Suspense>` boundary
  around the guard call — the guard can `redirect()`, which means it decides whether
  the page renders at all, not just what content streams in below it.
- **Adding a regression test so this can't silently regress**: see
  `tests/unit/admin-chat-moderation-page-instant.test.ts` for the pattern — mock
  `next/server`'s `connection`, mock the access guard, import the page module, and
  assert `instant === false` plus that `connection()` resolves before the guard runs.

## Common errors

- **"uncached data during prerendering" reappears after a refactor**: someone likely
  moved the access-guard call above `await connection()`, or dropped `connection()`
  entirely while keeping `instant = false`. Both lines are required together.
- **You added `instant = false` but the error still lists a *different* uncached call**:
  `instant = false` doesn't fix data access, it just stops validation from reporting it.
  If some other function in the same page reads `headers()`/`cookies()`/an uncached
  `fetch()`, it still runs — `instant = false` just means the dev overlay won't complain
  about it anymore. That's fine for a page that's fully session-gated anyway (like the
  admin pages above), but don't reach for it as a way to silence a real caching bug
  elsewhere in the tree.

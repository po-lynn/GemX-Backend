# GET /api/admin/reviews/badge-counts

**Auth:** admin session cookie, or an `internal`-role session holding the
`FEATURE_KEYS.REVIEWS` (`"reviews"`) permission — enforced by `requireAdminOrFeature`
(`lib/api-guard.ts`).

**Mobile flag:** not used by the mobile app — consumed by the admin panel sidebar only
(`useReviewsBadgeCounts` hook, `features/reviews/hooks/use-reviews-badge-counts.ts`,
fetched once on mount by `components/admin/AdminSidebar.tsx`).

## Request

No path params, no query params, no request body.

Headers: standard session cookie (`better-auth.session_token`), same as any other admin
page/API call.

## Response

`200 OK`:

```json
{
  "openCases": 3,
  "archivedSellers": 1
}
```

- `openCases` — count of distinct sellers currently matching at least one enabled
  reputation rule, computed live by `getReputationBadgeCounts()` →
  `computeCaseSummaries()` (`features/reviews/db/reputation-cases.ts`). Same computation
  that drives the Reputation Cases table's "All" tab count.
- `archivedSellers` — count of `seller_archive` rows with `restoredAt IS NULL` (currently
  archived, not restored).

Both values are non-negative integers; `0` for either is a valid, common response (e.g. in
a dev environment with no `seller_rating` rows, both fields are `0`).

### Errors

| Status | Body | Cause |
|---|---|---|
| 401 | `{ "error": "Unauthorized" }` | No session |
| 403 | `{ "error": "Forbidden" }` | Session exists but is neither `role === "admin"` nor an `internal` user holding the `reviews` feature key |

The route also calls `connection()` (Next.js) before the guard, so it's always
dynamically rendered — no `Cache-Control` caching of stale counts across requests.

## Example

```bash
curl -s \
  -H "Cookie: better-auth.session_token=<admin-session-cookie>" \
  "http://localhost:3000/api/admin/reviews/badge-counts"
```

Example response:

```json
{
  "openCases": 0,
  "archivedSellers": 0
}
```

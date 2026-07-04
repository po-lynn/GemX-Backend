# Premium Dealer Subscriptions — Group by User

## What Changed

Added a **"User"** option to the group-by control on the admin Premium Dealer
Subscriptions list (`/admin/credit/premium-dealer-subscriptions`), alongside the
existing Status and Package options.

Files touched:

- `features/points/components/PremiumDealerSubscriptionsTable.tsx`
  - Added `{ id: "user", label: "User" }` to `groupOptions`.
  - Added exported helper `subscriptionGroupKey(row, groupBy)` and passed it to
    `ListViewCard` as `getGroupKey`.
- `tests/component/premium-dealer-subscriptions-group-by-user.test.tsx` (new)

No server, query, schema, or API route changes.

## Data Flow

Grouping is purely client-side over the rows already on the current page:

1. `app/admin/credit/premium-dealer-subscriptions/page.tsx` (server component)
   fetches one page of rows via `getPremiumDealerSubscriptionsPaginated()`
   (unchanged) and passes them to `PremiumDealerSubscriptionsTable`.
2. `ListViewCard` (`components/admin/list-view/ListViewCard.tsx:1070`) buckets
   the sorted rows. For each row it first calls `getGroupKey(row, groupBy)`;
   a non-null return becomes the group key, otherwise it falls back to
   `String(row[groupBy])`.
3. `subscriptionGroupKey` returns a key only for `groupBy === "user"`:
   - `"Name (email)"` when both are present — the email suffix disambiguates
     two distinct users who share a display name.
   - Email alone when the name is null, name alone when the email is null.
   - `"Unknown user"` when the user join returned nothing (deleted account).
   - `null` for every other group id, so Status and Package keep using the
     default field lookup.
4. `ListViewTable` renders one collapsible header row per bucket with the key
   as its label and the bucket size as its count.

## Schema Impact

None.

## Auth & Permissions

Unchanged — the page still requires an admin session with
`FEATURE_KEYS.CREDIT_SUBSCRIPTIONS` (`requireFeatureAccess` in the page
component). The new code is client-side presentation only.

## Edge Cases & Known Limitations

- **Per-page grouping.** The list is server-paginated (20 rows/page), so groups
  only span the current page. A user with subscriptions on two pages appears as
  a group on each. This matches the existing Status/Package grouping behavior.
- **Null user joins.** `userName`/`userEmail` come from a `leftJoin` on `user`,
  so both can be null; those rows bucket under "Unknown user" rather than
  crashing or falling into the default `"other"` bucket.
- **Same name, different users.** Keys include the email, so they stay in
  separate groups. Two rows with the same name and *no* email would merge —
  accepted, since email is effectively always present.

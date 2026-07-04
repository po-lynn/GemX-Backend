# Adding a Group-By Option to a ListViewCard Table

The admin list views (`components/admin/list-view/ListViewCard.tsx`) ship with a
toolbar "Group" control. This guide shows how to add a new grouping dimension,
using the "Group by User" option on the Premium Dealer Subscriptions page as the
worked example.

## Prerequisites

None beyond the standard dev setup — grouping is client-side, so no env vars,
migrations, or API changes are involved.

## How It Works

`ListViewCard` groups the current page's rows when the admin picks an option:

- Each `GroupOption` is `{ id, label }`. By default the group key for a row is
  `String(row[id])` — so an option whose `id` matches a string field on the row
  needs nothing else.
- For derived or composite keys, pass `getGroupKey(row, groupBy)`. Return a
  string to use it as the key, or `null` to fall back to the default lookup.

## Add a Simple Option (field already on the row)

```tsx
const groupOptions: GroupOption[] = [
  { id: "status", label: "Status" },      // row.status is a string — done
  { id: "packageName", label: "Package" },
]

<ListViewCard groupOptions={groupOptions} ... />
```

## Add a Derived Option (the "User" example)

Rows have `userName`/`userEmail` (nullable, from a left join) but no `user`
field, so a resolver is required:

```tsx
// features/points/components/PremiumDealerSubscriptionsTable.tsx
export function subscriptionGroupKey(
  row: Pick<PremiumDealerSubscriptionRow, "userName" | "userEmail">,
  groupBy: string
): string | null {
  if (groupBy !== "user") return null            // others use default lookup
  if (row.userName && row.userEmail) return `${row.userName} (${row.userEmail})`
  return row.userName ?? row.userEmail ?? "Unknown user"
}

const groupOptions: GroupOption[] = [
  { id: "user", label: "User" },
  { id: "status", label: "Status" },
  { id: "packageName", label: "Package" },
]

<ListViewCard
  groupOptions={groupOptions}
  getGroupKey={subscriptionGroupKey}
  ...
/>
```

Optionally add `getGroupAggs(rows, groupBy)` to show aggregate pills in each
group header (see `ListViewCard.tsx:935`).

## Testing

Export the key resolver and unit-test it directly, then drive the UI with
Testing Library: click the toolbar button named "Group", pick the option inside
`role="menu"`, and assert on `.lv-grouprow-name` / `.lv-grouprow-count`
elements. Full example:
`tests/component/premium-dealer-subscriptions-group-by-user.test.tsx`.

## Common Errors

- **Everything lands in one group called "other".** The option `id` doesn't
  match a row field and `getGroupKey` returned `null`/`undefined` for it. Make
  the resolver handle that `groupBy` id.
- **Nullable fields crash or bucket as "null".** Left-joined fields can be
  null — always provide a fallback key (e.g. `"Unknown user"`).
- **Groups look incomplete.** Grouping only spans the current page of a
  server-paginated list. That's by design; widen the page size or filter first
  if you need a fuller picture.
- **jsdom test fails with `ResizeObserver is not defined`.** Stub it at the top
  of the test file (see the example test).

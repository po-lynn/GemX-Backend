# Guide: Bulk-deleting users from the admin panel

## Prerequisites

- Signed in to `/admin` as a user with `role: admin` or `role: internal`
  (`canAdminManageUsers` in `features/users/permissions/users.ts`).
- No extra env vars or dependencies — uses the existing Drizzle `db` and
  Better Auth session.

## How to use it

1. Go to `/admin/users`.
2. Select one or more rows with the row checkboxes.
3. In the bulk-action bar that appears, click **Delete**.
4. Confirm in the dialog ("Delete permanently").

This calls `bulkDeleteUsersAction(ids)`
(`features/users/actions/users.ts`), which hard-deletes the selected `user`
rows and refreshes the list. You cannot include your own account in the
selection — the action rejects the whole request if you do.

```tsx
// features/users/components/UsersTable.tsx
<button
  className="lv-bulkbtn danger"
  onClick={() => setDeleteTarget({ ids: rows.map((r) => r.id), onClear })}
>
  <Trash2 style={{ width: 13, height: 13 }} /> Delete
</button>
```

## How to extend it

- **Add per-row exclusion rules** (e.g. don't allow deleting other admins):
  add the check inside `bulkDeleteUsersAction` in
  `features/users/actions/users.ts`, next to the existing self-delete guard.
- **Report which specific IDs failed:** `deleteUsersInDb` in
  `features/users/db/users.ts` returns only a count; change its `.returning()`
  to return the deleted IDs and diff against the input to report skipped ones.
- **Reuse for another entity:** follow the same three-layer pattern — a bulk
  `db` helper using `inArray`, a server action that validates + checks
  permission + calls it, and a `renderBulkActions` button in the relevant
  `ListViewCard` usage (see `ProductsListView.tsx` for another example with
  `bulkSetProductStatus`).

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `"You cannot delete your own account."` | Your own user ID was included in the selection. | Deselect your own row and retry. |
| `"Unauthorized"` | Signed in as a role other than `admin`/`internal` (e.g. `portal`, `user`). | Use an admin/internal account. |
| `"Select at least one user"` | Bulk delete called with an empty selection (shouldn't happen via the UI, since the bulk bar only shows when rows are selected). | N/A — defensive validation only. |

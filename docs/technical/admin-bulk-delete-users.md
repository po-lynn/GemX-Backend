# Admin — Bulk Delete Users

## What changed

The admin Users list (`/admin/users`) already had per-user delete (from the
user edit page), but no way to delete users in bulk from the list view — the
bulk-action bar only had non-functional stub buttons (Verify KYC, Grant
points, Message, Suspend, Archive), none of which called a server action.
Added a working "Delete" bulk action alongside them.

**Files touched:**
- `features/users/schemas/users.ts` — new `userBulkDeleteSchema` (non-empty
  array of user IDs).
- `features/users/db/users.ts` — new `deleteUsersInDb(ids: string[])`, a bulk
  variant of the existing `deleteUserInDb(id: string)` using `inArray`.
- `features/users/actions/users.ts` — new `bulkDeleteUsersAction(userIds:
  string[])` server action.
- `features/users/components/UsersTable.tsx` — wired a "Delete" button into
  `renderBulkActions`, with a confirmation dialog (mirrors the single-user
  delete dialog in `UserForm.tsx`) before calling the action.
- `tests/unit/bulk-delete-users-action.test.ts` — new test file covering the
  action.

## Data flow

```
UsersTable (client) — bulk-select rows → click "Delete" → confirm dialog
  → bulkDeleteUsersAction(ids)                          [features/users/actions/users.ts]
      → userBulkDeleteSchema.safeParse({ userIds: ids })  (Zod validation)
      → requireActionRole(canAdminManageUsers)            (auth/permission check)
      → reject if session.user.id is in ids               ("cannot delete own account")
      → deleteUsersInDb(ids)                               [features/users/db/users.ts]
          → db.delete(user).where(inArray(user.id, ids)).returning(...)
      → revalidatePath("/admin/users")
      ← { success: true, count } | { error: "..." }
  ← UsersTable shows a toast, clears selection, router.refresh()
```

## Schema impact

None — no Drizzle schema changes. Deletion is a hard delete of `user` rows,
same as the existing single-user `deleteUserInDb`; cascading behavior for
related rows (listings, points, etc.) is whatever the DB foreign keys already
enforce and is unchanged by this feature.

## Auth & permissions

Gated by `requireActionRole(canAdminManageUsers)` — same as every other user
management action (`features/users/permissions/users.ts`: admin or internal
role). An admin/internal user cannot include their own ID in the bulk
selection; the whole request is rejected if they do (mirrors the single-delete
action's self-delete guard in `deleteUserAction`).

## Edge cases & known limitations

- The action is all-or-nothing on the guard check: if the caller's own ID is
  anywhere in the selection, nothing is deleted and an error is returned
  instead of silently deleting the rest. The admin must deselect their own row
  and retry.
- No partial-failure reporting beyond the returned `count` — if some IDs no
  longer exist (already deleted by someone else), `deleteUsersInDb` simply
  returns however many rows it actually deleted; the UI reports that count.
- The other bulk buttons (Verify KYC, Grant points, Message, Suspend, Archive)
  remain non-functional stubs, unchanged by this work — out of scope.

# Admin "Create User" — Error Handling Fix

## What changed

Fixed `createUserAction` in `features/users/actions/users.ts` (lines ~79-108) always
throwing an unhandled exception on any sign-up failure (duplicate email, weak password,
DB constraint violation, etc.), which the admin UI displayed as a generic
"Something went wrong. Please try again." instead of the real reason.

**Root cause:** `auth.api.signUpEmail` (better-auth) does not return `{ error }` on
failure — it *throws* a `better-call` `APIError` (see
`node_modules/better-call/dist/error.mjs`, `node_modules/better-auth/dist/api/routes/sign-up.mjs`).
The action's old code checked `if (result && "error" in result && result.error)`, which
is dead code against the installed better-auth version: every real failure path
(`USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`, `INVALID_PASSWORD`, `FAILED_TO_CREATE_USER`, …)
throws instead. The action had no `try/catch` around the call, so the exception
propagated out of the server action to the client. `UserForm.tsx`'s
`handleCreate()` (`features/users/components/UserForm.tsx`) catches that as a generic
`catch {}` block and shows the fallback string, hiding the actual cause.

**Files touched:**
- `features/users/actions/users.ts` — wrapped `auth.api.signUpEmail` in `try/catch`;
  error-message mapping (duplicate NRC / duplicate email / fallback to the thrown
  message) now runs against the caught error instead of a `result.error` field that
  never existed at runtime.
- `tests/unit/create-user-action-error-handling.test.ts` — new test file covering the
  fix.

## Data flow

```
UserForm (client) — handleCreate()
  → createUserAction(formData)                         [features/users/actions/users.ts]
      → userCreateSchema.safeParse(...)                 (Zod validation)
      → requireActionRole(canAdminManageUsers)          (auth/permission check)
      → auth.api.signUpEmail({ body: {...} })           (better-auth)
          ├─ success → applyDefaultPointsToNewUser, optional updateUserInDb (role/image/archived)
          │            → { success: true }
          └─ throws APIError (duplicate email, invalid password, DB failure, …)
               → caught in the new try/catch
               → mapped to a friendly { error: "..." } message
      ← { success: true } | { error: "..." }
  ← result.error is rendered directly in the form; only an actual thrown/rejected
    promise from createUserAction itself (not a returned {error}) still falls back
    to the generic "Something went wrong" message in UserForm.tsx.
```

## Auth & permissions

Unchanged — `requireActionRole(canAdminManageUsers)` still gates the action (admin/
internal session required), and the existing "internal role can only create portal/user
accounts" check is untouched.

## Schema impact

None — no Drizzle schema changes. `userCreateSchema` (Zod) is unchanged.

## Edge cases & known limitations

- The mapped messages depend on substring matching against the underlying error's
  `message` (e.g. `"unique"` + `"nrc"`, `"already exists"`). If better-auth or Postgres
  wording changes, these heuristics may stop matching and fall through to the raw
  thrown message (still shown to the admin, just less polished — no longer swallowed).
- `additionalFields.role` in `lib/auth.ts` is still overridden by the `admin()` plugin's
  own `role` field definition (`input: false`), so `role` continues to be applied via a
  follow-up `updateUserInDb` call after sign-up rather than in the `signUpEmail` body
  itself. This was already the existing behavior and is not changed by this fix.

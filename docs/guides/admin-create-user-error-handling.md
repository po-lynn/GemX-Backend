# Collaborator Guide: Admin "Create User" Error Handling

## What this feature does

When an admin submits `/admin/users/new` and the sign-up fails (duplicate email,
duplicate NRC, weak password, etc.), the form now shows the real reason instead of a
generic "Something went wrong. Please try again." message.

## Prerequisites

- Standard dev env (`.env.local`, PostgreSQL, `npm run dev`)
- No new env vars or dependencies

## How it works

`createUserAction` (`features/users/actions/users.ts`) wraps the call to
`auth.api.signUpEmail` in a `try/catch`. better-auth throws an `APIError` on failure
(it never returns `{ error }`), so any code path that expects a returned error object
will silently miss real failures. The catch block maps the thrown error's `message` to
a friendlier string for known cases (duplicate NRC, duplicate email) and otherwise
returns the raw message as `{ error }`.

```ts
try {
  await auth.api.signUpEmail({ body: { ... } })
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  if (/* duplicate nrc */) return { error: "This NRC number is already registered to another account." }
  if (/* duplicate email */) return { error: "A user with this email already exists." }
  return { error: msg || "Failed to create user." }
}
```

`UserForm.tsx`'s `handleCreate()` renders `result.error` directly when the action
*returns* one. Its generic `catch { setError("Something went wrong. Please try again.") }`
block only fires now if `createUserAction` itself throws/rejects unexpectedly (e.g. a
bug outside this try/catch, or the network/server layer failing) — not for ordinary
sign-up validation failures anymore.

## Extending it

### Add a new friendly error mapping

Add another substring check inside the `catch` block in `createUserAction`, following
the existing duplicate-NRC / duplicate-email pattern. Match on the caught error's
`message` (case-insensitively where useful) before falling back to returning the raw
message.

### Add the same pattern to another action that calls better-auth

Any server action calling `auth.api.*` (sign-up, sign-in, password reset, etc.) should
wrap the call in `try/catch` rather than checking for a returned `{ error }` field —
better-auth methods throw `APIError` on failure. See `changeUserPasswordAction` in the
same file for another example already using this pattern.

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Something went wrong. Please try again." with no useful detail | An exception is being thrown somewhere in the create-user flow outside the `try/catch` in `createUserAction` (or thrown before the DB/auth call, e.g. in Zod parsing) | Check server logs for the actual stack trace; if it's inside `signUpEmail`, make sure the call stays wrapped in the `try/catch` |
| A duplicate-email submission doesn't get the friendly message | The thrown error's `message` doesn't contain `"already exists"`/`"duplicate"`/`"unique"` (better-auth or Postgres wording changed) | Add a new substring check, or log `err.message` once to see the actual wording and match on that |

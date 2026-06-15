# Technical: Phone + Password Login (Web)

## What Changed

Portal role users can now sign in using their phone number instead of email. The same `/login` page handles both — it detects the input type and routes accordingly.

**Files touched:**
- `lib/phone.ts` — `normalizeMyanmarPhone` extended to accept `+959...` E.164 input
- `lib/login-detect.ts` — new `looksLikePhone()` utility (extracted for testability)
- `drizzle/schema/auth-schema.ts` — `phone` column gains `.unique()` constraint
- `drizzle/migrations/0054_tough_justin_hammer.sql` — migration adds `UNIQUE("phone")`
- `features/users/db/users.ts` — new `getUserEmailByPhone()` query
- `features/users/actions/users.ts` — phone normalized to E.164 on create and update
- `features/users/actions/phone-login.ts` — new `getEmailForPhoneLoginAction()` server action
- `components/auth/LoginForm.tsx` — smart detection, phone lookup, role-based redirect

## Data Flow

```
User types phone/email → looksLikePhone(input)
  → phone path: getEmailForPhoneLoginAction(rawPhone)
      → normalizeMyanmarPhone(rawPhone) → E.164
      → getUserEmailByPhone(normalized) → email string or null
      → null → "Invalid credentials" (no sign-in attempt)
  → email path: use directly

authClient.signIn.email({ email, password })
  → error → "Invalid credentials"
  → success → authClient.getSession() → role
      admin/internal → /admin
      portal → /portal
      else → /
```

## Schema Impact

Phone column changed from `text("phone")` to `text("phone").unique()`.

- Migration: `ALTER TABLE "user" ADD CONSTRAINT "user_phone_unique" UNIQUE("phone")`
- PostgreSQL allows multiple NULLs under the unique constraint — users without a phone are unaffected
- Phone is now normalized to E.164 (`+959XXXXXXX`) at write time in `createUserAction` and `updateUserAction`

**Data migration for existing rows:**
```sql
UPDATE "user" SET phone = '+95' || SUBSTRING(phone, 2) WHERE phone LIKE '09%';
```
Run this once on existing data after the schema migration.

## Auth & Permissions

- `getEmailForPhoneLoginAction` — no auth guard; called before any session exists
- Returns `null` for both invalid format and phone-not-found to prevent user enumeration
- Once the email is resolved, the standard `signIn.email()` flow handles auth — no changes to Better Auth config

## Edge Cases

- **Null phones**: users without a phone field cannot use phone login; NULL is not unique-constrained
- **Non-Myanmar numbers**: `normalizeMyanmarPhone` returns null → action returns null → "Invalid credentials"
- **Email that looks like a phone** (e.g. `1234567@gmail.com`): `looksLikePhone` checks for `@` and `.` — correctly treated as email
- **`internalEmailFromPhone` pattern**: mobile-registered users (role: user) use a synthetic `user_959...@phone.local` email. This login path resolves the portal user's real email from `user.phone` — a completely separate flow

# Dedup: shared storage-upload and server-action helpers

**Date:** 2026-06-11 · **Type:** refactor (no schema changes, no endpoint contract changes)

## What changed and why

A fallow duplication scan showed ~17.8% duplicated lines. The two biggest server-side clusters were consolidated:

1. **Supabase Storage upload flow** (~60 near-identical lines per route across six routes) → new [`lib/supabase/storage-upload.ts`](../../lib/supabase/storage-upload.ts). Refactored routes:
   - `app/api/upload/user-image/route.ts`
   - `app/api/upload/certificate/route.ts`
   - `app/api/upload/product-media/route.ts`
   - `app/api/profile/image/route.ts`
   - `app/api/categories/image/route.ts`
   - `app/api/chat/media/route.ts`
2. **Server-action boilerplate** (duplicated `emptyToNull`/`emptyToUndefined`, Zod error formatting, and session+role guards across 14 action files) → new [`lib/form-data.ts`](../../lib/form-data.ts) and [`lib/action-guard.ts`](../../lib/action-guard.ts). All files under `features/*/actions/` now import these instead of defining local copies.

Result: duplicated lines 7,950 → 7,598 (17.8% → 16.9%).

## Data flow

Upload routes now share one pipeline:

```
route POST
  → requireUploadContext(request)        # Better Auth session + getSupabaseAdmin(); 401/503 Response on failure
  → request.formData() / route-specific input parsing   # stays in the route
  → validateUploadFile(file, allowedTypes, maxSizeBytes)  # 400 Response or null
  → storageObjectPath(userId, file, fallbackExt, { timestamped? })  # <userId>/<uuid>.<ext>
  → uploadFileToBucket(supabase, { bucket, path, file, createBucketIfMissing? })
      # optional create-public-bucket-and-retry-once; RLS-aware 500 message; returns public URL
  → route formats the success response ({ url } / { urls } / jsonUncached)
```

Server actions share:

```
action(formData)
  → schema.safeParse(...)                       # field mapping stays in the action
  → zodErrorMessage(parsed.error)               # formErrors → fieldErrors → "Invalid input"
  → requireActionRole(canX)                     # session via next/headers cookie, role predicate; null on failure
  → db call (unchanged)
```

## Auth & permissions

- `requireUploadContext`: **session cookie / bearer** (whatever Better Auth resolves from request headers). Routes add extra checks on top (e.g. `categories/image` still requires `canAdminManageProducts`).
- `requireActionRole`: **session cookie** via `next/headers` — server actions only. Returns the full session so callers can use `session.user.id`.

## Behavior changes (intentional, error paths only)

- All upload-route error responses now carry `Cache-Control: no-store` (previously only some did).
- 401 message unified to `"Unauthorized. Sign in to upload files."` (chat/media previously said just `"Unauthorized"`).
- Validation messages unified to `Invalid file type: <name>. Allowed: ...` / `File too large: <name>. Max size: N MB` (image routes previously omitted the file name; chat/media had its own wording).
- RLS upload failures now always return the actionable service-role guidance, parameterized by bucket name.
- **Bug fix:** files with no extension (e.g. `photo`) now get the route's fallback extension; previously `"photo".split(".").pop()` made the whole name the extension.
- Server actions using the simple `formErrors`-only formatter now also surface field-level errors (`title: required`) instead of generic `"Invalid input"`.

Success-path responses, status codes, and request contracts are unchanged.

## Edge cases & known limitations

- `uploadFileToBucket` retries exactly once after creating a missing bucket (public). Routes that didn't have this retry (certificate, product-media) still don't — they omit `createBucketIfMissing`.
- `requireActionRole` deliberately returns `null` (not a typed error) so each action keeps its own error shape (`{ error }` vs `{ ok: false, error }`).
- The product-media sign route (`app/api/upload/product-media/sign/route.ts`) was left as-is: it signs URLs instead of uploading, so it shares only the auth/validation prologue.
- Remaining duplication (~16.9%) is dominated by the reference-data CRUD UI (`CategoryForm`/`LaboratoryForm`/`OriginForm`/`RatingTagForm` + matching Tables/ListViews, ~95% identical ×4) — a UI refactor that needs browser verification, tracked as follow-up.

## Tests

- `tests/unit/storage-upload.test.ts` — context guard (401/503/ok), validation, path generation (incl. fallback-ext fix), upload retry/RLS messaging.
- `tests/unit/form-data.test.ts` — `emptyToNull`, `emptyToUndefined`, `zodErrorMessage` precedence.
- `tests/unit/action-guard.test.ts` — `requireActionRole` (no session / wrong role / pass).
- Existing `tests/api/upload/**` pass unchanged (they pin the exact 401 and "No files provided." messages).

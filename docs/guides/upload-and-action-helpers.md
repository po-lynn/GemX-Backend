# Guide: building upload routes and server actions with the shared helpers

Use these helpers instead of copy-pasting auth/validation/upload blocks. They live in:

- `lib/supabase/storage-upload.ts` — file upload routes
- `lib/form-data.ts` — FormData/Zod utilities for server actions
- `lib/action-guard.ts` — role guard for server actions

## Prerequisites

- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (service_role secret, **not** the anon key) for uploads.
- Bucket constants are declared in `lib/supabase/server.ts` — add new buckets there.

## Writing a new upload route

```ts
import { NextRequest } from "next/server"
import {
  requireUploadContext,
  storageObjectPath,
  uploadFileToBucket,
  validateUploadFile,
} from "@/lib/supabase/storage-upload"
import { MY_BUCKET } from "@/lib/supabase/server"

const ALLOWED_TYPES = ["image/jpeg", "image/png"]
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(request: NextRequest) {
  try {
    const { ctx, error } = await requireUploadContext(request)
    if (error) return error // 401 (no session) or 503 (Supabase not configured)

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return Response.json({ error: "No file provided." }, { status: 400 })
    }

    const invalid = validateUploadFile(file, ALLOWED_TYPES, MAX_SIZE)
    if (invalid) return invalid // 400 with type/size message

    const result = await uploadFileToBucket(ctx.supabase, {
      bucket: MY_BUCKET,
      path: storageObjectPath(ctx.user.id, file, "jpg"),
      file,
      createBucketIfMissing: true, // omit to fail hard when the bucket is absent
    })
    if (result.error) return result.error // 500 with RLS-aware message

    return Response.json({ url: result.url })
  } catch (err) {
    console.error("POST /api/my-route:", err)
    return Response.json({ error: "Upload failed" }, { status: 500 })
  }
}
```

Extras:

- Admin-only route? Check the role after the context guard: `if (!canAdminManageX(ctx.user.role)) return jsonError("Forbidden", 403)`.
- Need collision-resistant names under load (chat)? `storageObjectPath(id, file, "bin", { timestamped: true })` → `<userId>/<ts>-<uuid>.<ext>`.
- Multiple files? Loop and call `validateUploadFile` + `uploadFileToBucket` per file (see `app/api/upload/product-media/route.ts`).

## Writing a new server action

```ts
"use server"

import { canAdminManageX } from "@/features/x/permissions/x"
import { emptyToNull, zodErrorMessage } from "@/lib/form-data"
import { requireActionRole } from "@/lib/action-guard"
import { xCreateSchema } from "@/features/x/schemas/x"

export async function createXAction(formData: FormData) {
  const parsed = xCreateSchema.safeParse({
    title: formData.get("title"),
    note: emptyToNull(formData.get("note")), // "" → null (clear), missing → undefined (skip)
  })
  if (!parsed.success) return { error: zodErrorMessage(parsed.error) }

  const session = await requireActionRole(canAdminManageX)
  if (!session) return { error: "Unauthorized" }

  // db work; session.user.id is available
  return { success: true }
}
```

- `requireActionRole` takes any `(role: string) => boolean` — pass a permission function or an inline predicate like `(role) => role === "admin"`.
- It returns the session or `null`; keep your action's own error shape.
- `emptyToUndefined` is the variant without null/clear semantics (used by messages).

## Common errors

| Symptom | Cause / fix |
|---|---|
| 503 "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY..." | Missing env vars — copy from `.env.example`, restart dev server |
| 500 mentioning "Storage RLS blocked upload" | `SUPABASE_SERVICE_ROLE_KEY` is the anon key, or bucket/RLS policies missing (`scripts/supabase-storage-policies.sql`) |
| 400 "Invalid file type: ..." | MIME type not in the route's allowlist — extend the route's `ALLOWED_*` constant |
| Action always returns "Unauthorized" in tests | Mock `next/headers` (`headers`) and `@/lib/auth` (`auth.api.getSession`) — see `tests/unit/action-guard.test.ts` |

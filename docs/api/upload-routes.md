# Upload routes

Six routes share the helper pipeline in `lib/supabase/storage-upload.ts` (see `docs/technical/dedup-upload-and-action-helpers.md`). Request/response contracts are unchanged by the 2026-06-11 refactor; error messages were unified (see shared errors below).

**Shared auth:** Better Auth session resolved from request headers (session cookie on web, bearer token on mobile).

**Shared errors (all routes):**

| Status | Body |
|---|---|
| 401 | `{ "error": "Unauthorized. Sign in to upload files." }` |
| 400 | `{ "error": "Invalid file type: <name>. Allowed: <list>" }` or `{ "error": "File too large: <name>. Max size: <N> MB" }` |
| 503 | `{ "error": "<Supabase configuration hint>" }` |
| 500 | `{ "error": "<upload failure; RLS guidance when storage RLS blocks the write>" }` |

All error responses are `Cache-Control: no-store`.

---

## POST /api/upload/user-image

Single profile image; returns public URL for `user.image`. **Mobile:** yes.
- Body: `multipart/form-data`, field `file`. Allowed: jpeg/png/webp/gif, max 5 MB.
- 200: `{ "url": "https://..." }`
- Bucket `user-images` is auto-created (public) if missing.

```bash
curl -X POST http://localhost:3000/api/upload/user-image \
  -H "Authorization: Bearer $TOKEN" -F "file=@avatar.png"
```

## POST /api/profile/image

Same contract as `/api/upload/user-image` (web profile page variant). **Mobile:** no.

## POST /api/categories/image

Category image. **Admin-only** — non-admin sessions get `403 { "error": "Forbidden" }` (`canAdminManageProducts`). **Mobile:** no.
- Body: field `file`. Allowed: jpeg/png/webp/gif, max 5 MB. Bucket `category-images`, auto-created.
- 200: `{ "url": "https://..." }`

## POST /api/upload/certificate

Lab report / certificate for `product.certReportUrl`. **Mobile:** yes.
- Body: field `file`. Allowed: pdf/jpeg/png/webp/gif, max 10 MB. Bucket `product-certificates` (must exist; no auto-create).
- 400 when field missing: `{ "error": "No file provided. Use form field 'file'." }`
- 200: `{ "url": "https://..." }`

## POST /api/upload/product-media

Multi-file product images/videos. **Mobile:** yes.
- Body: field `type` = `image` | `video`; files in `files` (repeatable) or single `file`.
  - image: jpeg/png/webp/gif, max 10 MB → bucket `product-images`
  - video: mp4/webm/quicktime, max 50 MB → bucket `product-videos`
- 400: `{ "error": "Missing or invalid type. Use type=image or type=video." }` / `{ "error": "No files provided." }`
- 200: `{ "urls": ["https://...", ...] }` (fails fast on the first invalid file)

```bash
curl -X POST http://localhost:3000/api/upload/product-media \
  -H "Authorization: Bearer $TOKEN" -F "type=image" \
  -F "files=@a.jpg" -F "files=@b.jpg"
```

## POST /api/chat/media

Single chat attachment; URL is embedded in the realtime message payload. **Mobile:** yes.
- Body: field `file`. Allowed: jpeg/png/webp/gif, webm/mpeg/mp4/aac/ogg/wav audio, pdf, doc, docx; max 20 MB. Bucket `chat-media`, auto-created. Object names are timestamp-prefixed.
- 200: `{ "url": "https://..." }` (`Cache-Control: no-store`)

---

Unchanged sibling: `POST /api/upload/product-media/sign` (signed direct-upload URLs) — not part of this refactor.

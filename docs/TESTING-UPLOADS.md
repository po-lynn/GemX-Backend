# Testing the upload APIs

Ways to test **POST /api/upload/product-media** (images/videos) and **POST /api/upload/certificate** (lab report).

---

## 1. In the browser (easiest)

1. Start the app: `npm run dev`.
2. Log in (admin or mobile user).
3. Go to **Admin → Products → New** (or edit a product).
4. **Images:** Use "Upload images" and choose file(s); you should see thumbnails and get URLs.
5. **Videos:** Use "Upload videos" and choose file(s); you should see previews and get URLs.
6. **Certificate:** Use "Upload certificate" and choose a PDF or image; the certificate viewer should show it.
7. Save the product; the uploaded URLs are stored in the product.

**Requirements:** `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, and the buckets (`product-images`, `product-videos`, `product-certificates`) + RLS (see README and `scripts/supabase-storage-policies.sql`).

---

## 2. With curl

You need a session token first, then send multipart form-data.

### Get a token (mobile login)

```bash
# Replace with your base URL and a real user
curl -s -X POST http://localhost:3000/api/mobile/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"09123456789","password":"your-password"}' | jq -r '.session.token'
```

Copy the printed token. If the response shape differs, use the field that contains the Bearer token.

### Upload product images

```bash
TOKEN="<paste-token-here>"
BASE="http://localhost:3000"

# One image
curl -s -X POST "$BASE/api/upload/product-media" \
  -H "Authorization: Bearer $TOKEN" \
  -F "type=image" \
  -F "file=@/path/to/your/image.jpg"

# Multiple images
curl -s -X POST "$BASE/api/upload/product-media" \
  -H "Authorization: Bearer $TOKEN" \
  -F "type=image" \
  -F "files=@/path/to/image1.jpg" \
  -F "files=@/path/to/image2.png"
```

Success: `{"urls":["https://...supabase.../product-images/..."]}`.

### Upload product video

```bash
curl -s -X POST "$BASE/api/upload/product-media" \
  -H "Authorization: Bearer $TOKEN" \
  -F "type=video" \
  -F "file=@/path/to/video.mp4"
```

---
## 2.1 Direct-to-Supabase (signed upload)

If you hit Vercel `413 FUNCTION_PAYLOAD_TOO_LARGE` for large videos, upload **directly to Supabase Storage** instead:

1. Call the signed-upload signer endpoint (auth required):

```bash
TOKEN="<paste-token-here>"
BASE="http://localhost:3000"

curl -s -X POST "$BASE/api/upload/product-media/sign" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "video",
    "filename": "video.mp4",
    "contentType": "video/mp4",
    "size": 12345678
  }'
```

2. The response includes a short-lived `token` and a `publicUrl`. Then upload the bytes using Supabase Storage SDK:

```ts
// Pseudocode (React Native / client)
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

await supabase.storage
  .from(bucket) // product-videos or product-images
  .uploadToSignedUrl(path, token, file, { contentType })
```

3. After upload completes, send `publicUrl` in your product payload as `videoUrls` (or `imageUrls`).

### Upload certificate (PDF or image)

```bash
curl -s -X POST "$BASE/api/upload/certificate" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/report.pdf"
```

Success: `{"url":"https://...supabase.../product-certificates/..."}`.

### Typical failures

- **401** – Missing or invalid token; log in again and use the new token.
- **400** – Wrong `type`, no file, or file type/size not allowed (see MOBILE-API.md §4.4 and §4.5).
- **503** – Supabase not configured or wrong key in `.env.local`.

---

## 3. Automated tests (Vitest)

```bash
npm run test:api
```

Upload routes are covered in `tests/api/upload/`: 401 without auth, 400 without file or bad type, 503 when Supabase is not configured. The success path (200) is tested via browser or curl (FormData + File in Node/Vitest can be inconsistent).

# Mobile API Documentation

**Convention:** When you change any API (mobile, public, or admin), update the "Recent changes" section and the affected route(s) in this file. See [docs/README.md](./README.md).

---

## Recent changes

- **GET /api/profile/:id** – Added public profile endpoint for viewing another seller and their active listings. No auth required.
- **Mobile register points credit** – `POST /api/mobile/register` now auto-credits the new user with configured **default registration points** (added directly to `user.points` after successful sign-up).
- **GET /api/products/:id** – Response includes **`createdAt`** and **`updatedAt`** (ISO 8601 strings). Not returned on product list endpoints. See **5.2**.
- **Push notifications** – When a new article is published (create or update to published), the backend sends an FCM push to all registered mobile app users (role `mobile`). Mobile app must register the device token via **POST /api/push/register** (auth required) with body `{ "token": "<fcm_token>", "platform": "android" | "ios" }`. Optional **DELETE /api/push/register** with body `{ "token": "<fcm_token>" }` to unregister. Backend requires `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` to send; if unset, push is skipped.
- **Register** – Request body now accepts optional fields: `nrc`, `address`, `city`, `state`, `country`, `gender`, `dateOfBirth`. Validation errors from the auth provider (e.g. password too short) are returned in the `error` field instead of a generic message.
- **GET /api/products** – Public list returns **active** products only by default; use query `status` to override. Query params include `isCollectorPiece`, `isPrivilegeAssist`, `isPromotion`, optional **`newest=true`** (new-products list: pure **`createdAt` desc**, ignored when **`search`** is set), optional **`sortBy`** / **`sortOrder`**, and optional **`createdFrom`** / **`createdTo`** (YYYY-MM-DD). **Default sort** (no `search`, no `newest`, no `sortBy`/`sortOrder`): collector → privilege assist → featured → promotion → `createdAt` (newest). **With `search`:** relevance first, then the same priority fields, then `createdAt` ( **`newest` is ignored** ). **New products:** `?newest=true` or `?newest=1` → newest listings by `createdAt` only (filters like `categoryId` still apply). **Explicit sort:** `sortBy` / `sortOrder` in the URL → admin-style column sort (when there is no `search`). Responses do **not** include a numeric `featured` field—only `isFeatured` (boolean).
- **GET /api/products/mine** – Same query params as list all, including `isCollectorPiece`, `isPrivilegeAssist`, and `isPromotion`. Returns all statuses by default (seller sees full list). Same sort order as public list when filters apply.
- **GET /api/products/:id** – Response includes **`createdAt`** / **`updatedAt`**, a `seller` object (id, name, phone, username, displayUsername), and `isCollectorPiece`, `isPrivilegeAssist`, `isPromotion`. No numeric `featured` field; use `isFeatured` (boolean).
- **GET /api/profile** – Returns current user profile and a list of **active** products only; optional query params (page, limit, search, filters) apply to that list.
- **GET /api/origins** – List origins for product create/edit (id, name, country).
- **GET /api/laboratories** – List laboratories for product create/edit (id, name, address, phone, precaution).
- **POST /api/products** and **PATCH /api/products/:id** – Request body uses `**jewelleryGemstones`** (lowercase `s`) for jewellery gemstone array. Optional `isCollectorPiece`, `isPrivilegeAssist`, and `isPromotion` (boolean). **`dimensions`** (product or each jewellery gemstone) may be a **string**, an **array of segments** (joined with ` × ` like the admin form), or an **object** `{ length, width, depth }` / `{ length, width, height }` / `{ part1, part2, part3 }` — see **5.5**. Validated up to **300** characters after normalization.
- **POST /api/products** / **PATCH /api/products/:id** – Featured now supports duration via `featureDurationDays` (0–365). When featured with a duration > 0, backend stores an expiry timestamp (`featuredExpiresAt`). Create/update also accept `isFeatured` + `featured` (points/priority; integer >= 0). `isPromotion` can be sent as boolean or `"true"/"1"` string and is normalized server-side.
- **Status update** – Product status can be updated via **PATCH /api/products/:id** with body `{ "status": "active" | "hidden" | "sold" | "archive" }`. Sellers can **mark an item as sold** by sending `{ "status": "sold" }`. See **5.6.1 Status update (e.g. Mark as sold)**.
- **Product media upload** – **POST /api/upload/product-media** is available for mobile: upload product images or videos (multipart/form-data), get back URLs, then send those URLs in **POST /api/products** or **PATCH /api/products/:id** as `imageUrls` / `videoUrls`. Same endpoint as admin product form. See **4.4 Product media upload**.
- **Direct-to-Supabase signed uploads** – Added **POST `/api/upload/product-media/sign`** (auth required) to generate short-lived signed upload tokens for direct uploads to Supabase Storage. Use `publicUrl` in your product payload; avoids Vercel upload-size limits for large videos.
- **Certificate upload** – **POST /api/upload/certificate** uploads a single lab report / certificate file (PDF or image). Returns `{ "url": "..." }` to use as `certReportUrl` in product create/update. See **4.5 Certificate upload**.
- **Feature with points (mobile)** – Added **POST `/api/mobile/products/:id/feature`** (auth required). Request body: `{ "durationDays": number, "points": number }`. If the selected duration/points tier is valid and the user has enough points, backend deducts points from balance and marks the product as featured. If balance is insufficient, returns **400** with `{ "error": "Insufficient points balance" }`.
- **Feature pricing tiers (mobile)** – Added **GET `/api/mobile/feature-pricing-tiers`** (no auth). Returns only `durationDays` + `points` options (from `feature_pricing_tiers_json`) for mobile selection UI.
- **Purchase points (mobile)** – Added **POST `/api/mobile/points/purchase`** (auth required). Request body: `{ "currency": "mmk" | "usd" | "krw", "amount": number }`. Backend converts amount to points using point settings and credits user balance. Returns updated points balance.
- **Product search (fast and smart)** – Main search: when the user taps "Search", call **GET /api/products** with `search`, `page`, and `limit` only (omit other filters). Backend uses full-text search (title + description) and seller match; results are ranked by relevance then collector/privilege/featured/newest. Autocomplete: **GET /api/products/suggestions?q=...** returns distinct product title suggestions (min 2 chars for `q`; optional `limit` 5–10). Response: `{ "suggestions": [{ "label": "Sapphire" }, ...] }`, ordered by title starts-with, then contains, then newest. Caching: product list 60s/300s; suggestions 30s/60s. **Instruction and guide for mobile:** see **5.1** (instruction table), **5.1.1** (suggestions API), **5.1.2** (debouncing, flows, errors).

---

## 1. API routes overview


| Method | Path                   | Auth | Description                                                                                                                                                                                              |
| ------ | ---------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/mobile/register` | No   | Register (phone, password, name)                                                                                                                                                                         |
| POST   | `/api/mobile/login`    | No   | Login (phone, password)                                                                                                                                                                                  |
| GET    | `/api/mobile/feature-pricing-tiers` | No   | Get feature duration/points tiers for mobile selection (`durationDays`, `points`, optional `badge`).                                                                                               |
| POST   | `/api/mobile/products/:id/feature` | Yes  | Use points to feature a product for a selected duration tier. Deducts points on success; returns error when balance is insufficient.                                                                 |
| POST   | `/api/mobile/points/purchase` | Yes  | Purchase points by amount/currency. Converts by point settings and credits user points balance.                                                                                                       |
| GET    | `/api/categories`      | No   | List categories. Query: `type` (optional)                                                                                                                                                                |
| GET    | `/api/origins`         | No   | List origins (for product create/edit).                                                                                                                                                                  |
| GET    | `/api/laboratories`    | No   | List laboratories (for product create/edit).                                                                                                                                                             |
| POST   | `/api/upload/product-media` | Yes  | Upload product images or videos (multipart); returns URLs for `imageUrls` / `videoUrls`. See 4.4.                                                                                                        |
| POST   | `/api/upload/product-media/sign` | Yes  | Generate signed upload token for direct-to-Supabase media uploads (use `publicUrl` in product payload). Auth required.                                                                                                        |
| POST   | `/api/upload/certificate`   | Yes  | Upload one lab report / certificate file (PDF or image); returns `url` for `certReportUrl`. See 4.5.                                                                                                     |
| GET    | `/api/products`        | No   | List products (default **active** only). Query: `page`, `limit`, `search`, `productType`, `categoryId`, `status`, `stoneCut`, `shape`, `origin`, `laboratoryId`, `isCollectorPiece`, `isPrivilegeAssist`. With `search`, results are full-text ranked (title/description + seller). Cached 60s/300s. |
| GET    | `/api/products/suggestions` | No   | Autocomplete suggestions (distinct titles). Query: `q` (min 2 chars), optional `limit` (default 5, max 10). Cached 30s/60s. See 5.1.1. |
| GET    | `/api/products`        | No   | List products (default **active** only). Query: `page`, `limit`, `search`, `productType`, `categoryId`, `status`, `stoneCut`, `metal`, `identification`, `shape`, `origin`, `laboratoryId`, `isCollectorPiece`, `isPrivilegeAssist` |
| GET    | `/api/products/:id`    | No   | Get single product by ID                                                                                                                                                                                 |
| GET    | `/api/products/mine`   | Yes  | List current user’s products. All statuses by default. Same query params as list all.                                                                                                                    |
| GET    | `/api/profile`         | Yes  | Get current user profile and their products (optional query: page, limit, filters).                                                                                                                      |
| GET    | `/api/profile/:id`     | No   | Get a public seller profile and their active products (optional query: page, limit, filters).                                                                                                            |
| POST   | `/api/products`        | Yes  | Create product (JSON body)                                                                                                                                                                               |
| PATCH  | `/api/products/:id`    | Yes  | Update product (owner or admin). JSON body.                                                                                                                                                              |
| DELETE | `/api/products/:id`    | Yes  | Delete product (owner or admin)                                                                                                                                                                          |
| GET    | `/api/news`            | No   | List news. Query: `page`, `limit`, `status` (optional)                                                                                                                                                   |
| GET    | `/api/news/:id`        | No   | Get single news by ID (published only)                                                                                                                                                                   |
| GET    | `/api/articles`        | No   | List articles. Query: `page`, `limit`, `status` (optional)                                                                                                                                               |
| GET    | `/api/articles/:id`    | No   | Get single article by ID (published only)                                                                                                                                                                |
| POST   | `/api/push/register`   | Yes  | Register FCM device token for push (body: `token`, optional `platform`: `android` \| `ios`). Call after login.                                                                                             |
| DELETE | `/api/push/register`   | Yes  | Unregister FCM device token (body: `token`). Call on logout.                                                                                                                                             |


List responses (`GET /api/products`, `GET /api/products/suggestions`, `GET /api/products/mine`, `GET /api/news`, `GET /api/articles`) may be cached. **GET /api/products** and **GET /api/products/mine**: 60s s-maxage, 300s stale-while-revalidate. **GET /api/products/suggestions**: 30s s-maxage, 60s stale-while-revalidate. Filter and search query params are part of the cache key so each combination returns the correct result.

---

## 2. Base URL and headers

- **Base URL:** `https://gem-x-backend.vercel.app` (e.g. `http://localhost:3000` in dev)
- **Content-Type:** `application/json` for JSON request bodies. For **POST /api/upload/product-media** and **POST /api/upload/certificate** use `multipart/form-data` (do not set Content-Type manually; let the client set it with the boundary).
- **Auth:** For protected routes, send the session token:
  - **Header:** `Authorization: Bearer <session_token>`
  - Get the token from the **Login** or **Register** response and store it (e.g. SecureStore). Use it on every request that requires auth.

---

## 3. Authentication

### 3.1 Register (create account)

**POST** `/api/mobile/register`

**Request body:**

```json
{
  "phone": "09123456789",
  "password": "your-secure-password",
  "name": "John Doe",
  "nrc": "12/ABC(N)123456",
  "address": "No. 1, Main Road",
  "city": "Yangon",
  "state": "Yangon",
  "country": "Myanmar",
  "gender": "male",
  "dateOfBirth": "1990-01-15"
}
```


| Field           | Type   | Required | Description                                                            |
| --------------- | ------ | -------- | ---------------------------------------------------------------------- |
| **phone**       | string | Yes      | Myanmar phone, must start with `09`, 9–17 digits (e.g. `09123456789`). |
| **password**    | string | Yes      | User password.                                                         |
| **name**        | string | No       | Display name; defaults to `"Mobile User"`.                             |
| **nrc**         | string | No       | National Registration Card number.                                     |
| **address**     | string | No       | Street address.                                                        |
| **city**        | string | No       | City.                                                                  |
| **state**       | string | No       | State / region.                                                        |
| **country**     | string | No       | Country.                                                               |
| **gender**      | string | No       | Gender (e.g. `male`, `female`, `other`).                               |
| **dateOfBirth** | string | No       | Date of birth (e.g. `YYYY-MM-DD`).                                     |


**Success (201):** Response body is the auth result (user + session). Store the **session token** from the response for the `Authorization: Bearer` header.

After successful register, backend also auto-adds the configured **default registration points** to the new user balance.

**Errors:**

- **400** – `{ "error": "Phone must start with 09 and password is required" }` or other validation message (e.g. `"Password is too short"` from the auth provider).
- **409** – `{ "error": "This phone number is already registered" }` when the phone is already in use.
- **4xx/5xx** – Response body includes an `error` string with the actual message (e.g. auth validation errors).

**Note:** If default registration points are configured as `0`, no points are added.

---

### 3.2 Login

**POST** `/api/mobile/login`

**Request body:**

```json
{
  "phone": "09123456789",
  "password": "your-password"
}
```

**Success (200):** Auth result with session. Store the **session token** and use it as `Authorization: Bearer <token>`.

**Errors:**

- **400** – Invalid phone format or missing password.
- **401** – `{ "error": "Invalid phone number or password" }`

---

## 4. Categories (read-only)

Used for dropdowns/filters when creating or editing products. **No auth required.**

### 4.1 List categories

**GET** `/api/categories`

**Query (optional):**


| Param  | Type   | Description                                                   |
| ------ | ------ | ------------------------------------------------------------- |
| `type` | string | `loose_stone` or `jewellery` to filter by type. Omit for all. |


**Examples:**

- All: `GET /api/categories`
- Loose stones only: `GET /api/categories?type=loose_stone`
- Jewellery only: `GET /api/categories?type=jewellery`

**Success (200):** Array of categories.

```json
[
  {
    "id": "uuid",
    "type": "loose_stone",
    "name": "Sapphire",
    "slug": "sapphire",
    "sortOrder": 0
  }
]
```

**Use in app:** Call this once (e.g. on app start or when opening “Add product”), cache the list, and use `id` / `name` for product `categoryId` and UI.

---

### 4.2 List origins (for product create/edit)

**GET** `/api/origins`

**Auth:** Not required.

**Success (200):** Array of origins.

```json
[
  { "id": "uuid", "name": "Myanmar", "country": "Myanmar" },
  { "id": "uuid", "name": "Sri Lanka", "country": "Sri Lanka" }
]
```


| Field     | Type   | Description |
| --------- | ------ | ----------- |
| `id`      | string | Origin UUID |
| `name`    | string | Origin name |
| `country` | string | Country     |


**Use in app:** Call when building the product form (create/edit). Use `name` for the product `origin` field (loose stones and jewellery gemstones) or for filter dropdowns.

---

### 4.3 List laboratories (for product create/edit)

**GET** `/api/laboratories`

**Auth:** Not required.

**Success (200):** Array of laboratories.

```json
[
  { "id": "uuid", "name": "GIA", "address": "123 Lab St", "phone": "+1234567890", "precaution": null },
  { "id": "uuid", "name": "Local Lab", "address": "456 Gem Rd", "phone": "+959123456789", "precaution": "Re-check recommended" }
]
```


| Field        | Type          | Description              |
| ------------ | ------------- | ------------------------ |
| `id`         | string        | Laboratory UUID          |
| `name`       | string        | Laboratory name          |
| `address`    | string        | Address                  |
| `phone`      | string        | Phone                    |
| `precaution` | string | null | Optional precaution note |


**Use in app:** Call when building the product form (create/edit). Use `id` for the product `laboratoryId` field (certification) or for filter dropdowns.

---

### 4.4 Product media upload (images and videos)

Use this endpoint to upload product images or videos before creating or updating a product. You get back public URLs to send in `imageUrls` or `videoUrls` in **POST /api/products** or **PATCH /api/products/:id**. Same endpoint as the admin product form; mobile uses it with `Authorization: Bearer <session_token>`.

For production video uploads (large files), prefer **direct-to-Supabase** signed upload to avoid Vercel request-size limits:
1. Call **POST** `/api/upload/product-media/sign` (auth required) to get `{ bucket, path, token, publicUrl }`.
2. Upload the bytes directly to Supabase Storage using the returned `token` (e.g. `uploadToSignedUrl(path, token, file)`).
3. Send the returned `publicUrl` in your product payload as `videoUrls` (or `imageUrls`).

#### 4.4a Direct-to-Supabase signed upload (recommended for large videos)

Use this flow for video uploads in production (avoids Vercel `413 FUNCTION_PAYLOAD_TOO_LARGE`).

**Step 1 — Sign an upload (auth required)**

**POST** `/api/upload/product-media/sign`

**Headers:**
- `Authorization: Bearer <session_token>`
- `Content-Type: application/json`

**Body:**

```json
{
  "type": "video",
  "filename": "my-video.mp4",
  "contentType": "video/mp4",
  "size": 12345678
}
```

**Success (200):**

```json
{
  "bucket": "product-videos",
  "path": "<userId>/<uuid>.mp4",
  "token": "<signed_upload_token>",
  "publicUrl": "https://...supabase.co/storage/v1/object/public/product-videos/<userId>/<uuid>.mp4",
  "contentType": "video/mp4"
}
```

**Step 2 — Upload bytes directly to Supabase Storage**

Use Supabase **anon** key (safe to ship in mobile) and upload using the signed token:

```ts
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

await supabase.storage
  .from(bucket)
  .uploadToSignedUrl(path, token, fileBody, { contentType })
```

- `fileBody` is the binary content (Blob/ArrayBuffer) of the video.
- Do **not** use the service role key in the app.

**Step 3 — Create/update product with the returned URL**

Put `publicUrl` into your product payload:
- Create: `POST /api/products` with `"videoUrls": ["<publicUrl>"]`
- Update: `PATCH /api/products/:id` with `"videoUrls": ["<publicUrl>", ...]`

**POST** `/api/upload/product-media`

**Auth:** Required. `Authorization: Bearer <session_token>`.

**Request:** `multipart/form-data` (do not set `Content-Type` manually; the client sets it with the boundary).

| Field   | Type   | Required | Description                                                                 |
| ------- | ------ | -------- | --------------------------------------------------------------------------- |
| `type`  | string | Yes      | `image` or `video`. Determines allowed MIME types and size limit.           |
| `file`  | file   | No*      | Single file. Use when uploading one file.                                    |
| `files` | file[] | No*      | Multiple files. Use when uploading more than one file.                      |

\* One of `file` or `files` must be present. If both are present, `files` is used.

**Product limits (enforced on create/update):** Up to **10 images** and **5 videos** per product. Upload in batches if needed; collect all URLs and send them in the product payload.

**Allowed types and sizes:**

| type   | Allowed MIME types                          | Max size per file |
| ------ | -------------------------------------------- | ----------------- |
| `image` | `image/jpeg`, `image/png`, `image/webp`, `image/gif` | 10 MB              |
| `video` | `video/mp4`, `video/webm`, `video/quicktime` (.mov)   | 100 MB             |

**Example (React Native):** Build `FormData`, append `type` (`image` or `video`) and the file(s) under key `file` or `files`, then POST with Bearer token. Do not set `Content-Type` header (fetch will set `multipart/form-data` with boundary).

**Success (200):**

```json
{
  "urls": [
    "https://...supabase.co/storage/v1/object/public/product-images/userId/uuid.jpg",
    "https://...supabase.co/storage/v1/object/public/product-images/userId/uuid2.png"
  ]
}
```

Append these URLs to your `imageUrls` or `videoUrls` array when calling **POST /api/products** or **PATCH /api/products/:id**.

**Errors:**

- **400** – Missing or invalid `type` (must be `image` or `video`); no file provided; invalid file type; file too large.
- **401** – `{ "error": "Unauthorized. Sign in to upload files." }`
- **503** – Supabase not configured (missing `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`). Body includes a message.
- **500** – Upload failed (e.g. Storage error; message may mention RLS if the wrong key is used).

---

### 4.5 Certificate upload (lab report)

Upload a single lab report or certificate file (PDF or image) for a product. Use the returned URL as `certReportUrl` in **POST /api/products** or **PATCH /api/products/:id**. Admin form has no Report URL text input; certificate is upload-only and displayed in a viewer (PDF iframe or image).

**POST** `/api/upload/certificate`

**Auth:** Required. `Authorization: Bearer <session_token>`.

**Request:** `multipart/form-data` with one file.

| Field  | Type | Required | Description                    |
| ------ | ---- | -------- | ------------------------------ |
| `file` | file | Yes      | Single file (PDF or image).    |

**Allowed types and size:**

| MIME types | Max size |
| ---------- | -------- |
| `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `image/gif` | 10 MB |

**Success (200):**

```json
{
  "url": "https://...supabase.co/storage/v1/object/public/product-certificates/userId/uuid.pdf"
}
```

Use this `url` as `certReportUrl` when creating or updating the product.

**Errors:**

- **400** – No file provided; invalid file type; file too large.
- **401** – Unauthorized.
- **503** – Supabase not configured.
- **500** – Upload failed.

---

## 5. Products

### 5.1 List all products (public)

**GET** `/api/products`

**Auth:** Not required.

**Search & suggestions — instruction for mobile**

| Step | Action | Endpoint / params |
|------|--------|-------------------|
| 1. **Autocomplete** | While the user types in the search bar, after debounce (200–300 ms) and only if query length ≥ 2 | **GET /api/products/suggestions?q=&lt;query&gt;** (optional: `limit`, default 5, max 10). Show the returned `suggestions` under the input. |
| 2. **Run search** | When the user taps **Search** or taps a suggestion | **GET /api/products?search=&lt;query&gt;&page=1&limit=20** — send **only** `search`, `page`, and `limit` (no other filters). |
| 3. **Pagination** | Load more results | Same **GET /api/products** with same `search` and `limit`, increment `page`. |
| 4. **Errors** | Suggestions request fails | Hide suggestions; user can still tap Search to run full search. |
| 5. **Errors** | Product list request fails | Show error + retry; do not leave list empty without feedback. |

Details: **5.1.1** (suggestions API), **5.1.2** (debouncing, flows, errors). Code reference: [CODE-SEARCH-SUGGESTIONS.md](./CODE-SEARCH-SUGGESTIONS.md).

---

**Behaviour:** The public list returns **active** products only by default. Use the `status` query param to request other statuses (e.g. `archive`, `sold`, `hidden`) if needed. Use `isCollectorPiece=true` to list only collector pieces (high-value items); use `isPrivilegeAssist=true` to list only Privilege Assist products (sold by us).

**Sort order:**  
- **With `search`:** (1) full-text **relevance**, (2) collector pieces, (3) privilege assist, (4) featured, (5) promotion, (6) `createdAt` (newest first). **`newest=true` is ignored** so search always uses this ordering.  
- **No `search`, default browse / filters only:** (1) collector pieces, (2) privilege assist, (3) featured, (4) promotion, (5) `createdAt` (newest first).  
- **No `search`, new-products list:** `newest=true` or `newest=1` → sort by **`createdAt` only** (newest first). You can combine with filters (e.g. `categoryId`, `productType`).  
- **No `search`, explicit admin sort:** `sortBy` and/or `sortOrder` in the query → sort by that column only (same as admin).  
The API does **not** return a numeric `featured` field—only `isFeatured` (boolean).

**Query:**


| Param               | Type    | Default  | Description                                                                              |
| ------------------- | ------- | -------- | ---------------------------------------------------------------------------------------- |
| `page`              | number  | 1        | Page number                                                                              |
| `limit`             | number  | 20       | Items per page (max 100)                                                                 |
| `search`            | string  | -        | Search in title and seller                                                               |
| `productType`       | string  | -        | Filter by type: `loose_stone` or `jewellery`                                             |
| `categoryId`        | string  | -        | Filter by category UUID (from GET /api/categories)                                       |
| `status`            | string  | `active` | Filter by status: `active`, `archive`, `sold`, `hidden`. Public list defaults to active. |
| `stoneCut`          | string  | -        | Filter by cut: `Faceted` or `Cabochon` (loose stones)                                    |
| `shape`             | string  | -        | Filter by shape: `Oval`, `Cushion`, `Round`, `Pear`, `Heart`                             |
| `origin`            | string  | -        | Filter by origin name (e.g. from GET /api/origins or your origins list)                  |
| `laboratoryId`      | string  | -        | Filter by laboratory UUID (from GET /api/laboratories)                                   |
| `isCollectorPiece`  | boolean | -        | When `true`, return only collector pieces (high-value items).                            |
| `isPrivilegeAssist` | boolean | -        | When `true`, return only Privilege Assist products (sold by us).                         |
| `isPromotion`       | boolean | -        | When `true`, return only promotion items.                                                |
| `newest`            | string  | -        | If `true` or `1` and **no** `search`: sort by **`createdAt` desc only** (new-products list). With `search`, ignored. |
| `sortBy`            | string  | -        | Omit for default marketplace ordering. If set (or `sortOrder` is set) and **no** `search`: `createdAt`, `title`, `price`, or `status`. |
| `sortOrder`         | string  | `desc`   | With explicit sort: `asc` or `desc`.                                                     |
| `createdFrom`       | string  | -        | Inclusive start date `YYYY-MM-DD` (filter by `createdAt`).                               |
| `createdTo`         | string  | -        | Inclusive end date `YYYY-MM-DD`.                                                         |


**Success (200):** See response shape below.

---

#### 5.1.1 Product search suggestions (autocomplete)

Use this endpoint to show autocomplete suggestions as the user types in the product search bar. When the user taps a suggestion or the "Search" button, call **GET /api/products** with `search=<query>&page=1&limit=20` (and no other filters) to show results in the product list.

**GET** `/api/products/suggestions`

**Auth:** Not required.

**Query:**

| Param   | Type   | Required | Description |
| ------- | ------ | -------- | ----------- |
| `q`     | string | Yes      | Search query. Minimum 2 characters. Suggestions are based on **product title** (active products only). |
| `limit` | number | No       | Max number of suggestions to return. Default 5, max 10. |

**Success (200):**

```json
{
  "suggestions": [
    { "label": "Sapphire" },
    { "label": "Sapphire Ring" },
    { "label": "Sapphire Necklace" }
  ]
}
```

**Ordering:** Titles that **start with** the query appear first, then titles that **contain** the query, then by newest product. Duplicate titles are collapsed (one suggestion per distinct title).

**When `q` is empty or shorter than 2 characters:** Response is `{ "suggestions": [] }` (200).

**Use in app:** Debounce input (e.g. 200–300 ms) and call this endpoint when `q.length >= 2`. On suggestion tap or "Search" submit, navigate to the product list and call `GET /api/products?search=<final_query>&page=1&limit=20` (do not send other filters).

**Caching:** `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`. Same `q` may be served from edge cache. Rate limiting on this endpoint is recommended for production.

**Implementation reference:** For API contract and mobile UX, use this doc (5.1.1, 5.1.2). For line-by-line code and behaviour details: [CODE-SEARCH-SUGGESTIONS.md](./CODE-SEARCH-SUGGESTIONS.md) and [TECHNICAL-PRODUCTS.md](./TECHNICAL-PRODUCTS.md) § 1.5.

---

#### 5.1.2 Mobile search UX: debouncing, flows, and errors

**Quick guide:** See the instruction table in **5.1** above. Summary: debounce suggestions (200–300 ms), call suggestions only when `q.length >= 2`, on submit/suggestion tap call list with `search` only, then paginate with same endpoint.

**Debouncing for suggestions:** On each change of the search input, start a debounce timer (recommended 200–300 ms). When the timer fires, if `q.length >= 2`, call **GET /api/products/suggestions?q=...**. Cancel any in-flight suggestions request when the user types again (new request replaces the previous one). Do not send a request on every keystroke.

**Request flow:**
1. **While typing:** Debounced calls to **GET /api/products/suggestions?q=...**; show the returned suggestions under the input.
2. **On "Search" tap or suggestion tap:** Navigate to the product list screen and call **GET /api/products?search=&lt;final_query&gt;&page=1&limit=20** with no other query params (filters are cleared for this search).
3. **Product list:** Use the same **GET /api/products** for pagination (increment `page`, keep `search` and `limit`).

**Error handling:**
- **Suggestions request fails (network or 5xx):** Hide or clear the suggestions list; do not block the user. They can still tap "Search" to run the full search.
- **Product list request fails:** Show an error message (e.g. "Could not load results") and a retry action. Do not leave the list empty without feedback.

---

#### Search and filter (products list)

The list endpoints support **search**, **filters**, and **pagination**. Use the same query params for **GET /api/products** (all products) and **GET /api/products/mine** (my products).

**Query parameters**


| Param               | Type    | Default | Description                                                                                                                       |
| ------------------- | ------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `page`              | number  | 1       | Page number (1-based).                                                                                                            |
| `limit`             | number  | 20      | Items per page (max 100).                                                                                                         |
| `search`            | string  | -       | Search term. Matches **product title**, **seller name**, **seller phone**, and **seller email** (case-insensitive partial match). |
| `productType`       | string  | -       | Filter by product type: `loose_stone` or `jewellery`.                                                                             |
| `categoryId`        | string  | -       | Filter by category (UUID from GET /api/categories).                                                                               |
| `status`            | string  | -       | Filter by status: `active`, `archive`, `sold`, `hidden`. Public list defaults to `active`.                                        |
| `stoneCut`          | string  | -       | Filter by cut: `Faceted` or `Cabochon`.                                                                                           |
| `metal`             | string  | -       | Filter by metal: `Gold`, `Silver`, `Other` (typically jewellery only).                                                             |
| `identification`    | string  | -       | Filter by identification: `Natural`, `Heat Treated`, `Treatments`, `Others`.                                                       |
| `shape`             | string  | -       | Filter by shape: `Oval`, `Cushion`, `Round`, `Pear`, `Heart`.                                                                     |
| `origin`            | string  | -       | Filter by origin name.                                                                                                            |
| `laboratoryId`      | string  | -       | Filter by laboratory (UUID from GET /api/laboratories).                                                                           |
| `isCollectorPiece`  | boolean | -       | When `true`, only collector pieces.                                                                                               |
| `isPrivilegeAssist` | boolean | -       | When `true`, only Privilege Assist (sold by us).                                                                                  |


**What is matched by `search`**

- Product **title** and **description** (full-text search; e.g. `"sapphire"` or `"sapphire ring"` finds relevant listings; prefix and multi-word supported)
- Seller **name**, **phone**, and **email** (case-insensitive partial match)

When `search` is present, results are ordered by **relevance** (full-text rank) first, then collector piece, privilege assist, featured, then newest.

**Pagination**

- Response includes `total` (total number of items). Use it to compute total pages: `totalPages = Math.ceil(total / limit)`.
- For “Load more” or infinite scroll: keep `limit` fixed, increment `page` (e.g. page=1, then 2, then 3).

**Examples**

**1. First page, default page size (20)**

```
GET /api/products
GET /api/products?page=1&limit=20
```

**2. Search by keyword (e.g. “sapphire”)**

```
GET /api/products?search=sapphire
```

**3. Search + pagination (second page of search results, 10 per page)**

```
GET /api/products?search=ruby&page=2&limit=10
```

**4. My products with search (seller’s own listings)**

```
GET /api/products/mine?search=ring
Authorization: Bearer <session_token>
```

**5. Filter by type and status (e.g. active loose stones only)**

```
GET /api/products?productType=loose_stone&status=active
GET /api/products/mine?productType=jewellery&status=active
Authorization: Bearer <session_token>
```

**6. Filter by cut, shape, origin, or laboratory**

```
GET /api/products?stoneCut=Cabochon
GET /api/products?shape=Oval&origin=Myanmar
GET /api/products?laboratoryId=<uuid-from-api>
GET /api/products/mine?stoneCut=Faceted&status=active
Authorization: Bearer <session_token>
```

**7. Filter by metal or identification**

```
GET /api/products?metal=Gold
GET /api/products?identification=Natural
GET /api/products?metal=Gold&identification=Heat%20Treated&productType=jewellery
```

**8. Collector pieces only (high-value items)**

```
GET /api/products?isCollectorPiece=true
GET /api/products/mine?isCollectorPiece=true
Authorization: Bearer <session_token>
```

**9. Privilege Assist only (products sold by us)**

```
GET /api/products?isPrivilegeAssist=true
GET /api/products/mine?isPrivilegeAssist=true
Authorization: Bearer <session_token>
```

**Success (200):**

```json
{
  "products": [
    {
      "id": "uuid",
      "sku": "PRD-XXX",
      "title": "Red Necklace",
      "description": "...",
      "identification": "Natural",
      "price": "2500",
      "dimensions": "8.2mm",
      "currency": "USD",
      "productType": "loose_stone",
      "categoryId": "uuid",
      "categoryName": "Sapphire",
      "stoneCut": "Faceted",
      "metal": null,
      "status": "active",
      "moderationStatus": "approved",
      "isFeatured": false,
      "isCollectorPiece": false,
      "isPrivilegeAssist": false,
      "isPromotion": false,
      "sellerId": "uuid",
      "sellerName": "John",
      "sellerPhone": null,
      "imageUrl": "https://...",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total": 42
}
```

Each product item includes `isCollectorPiece`, `isPrivilegeAssist`, `isPromotion`, and `isFeatured` (all booleans). The API does not return a numeric `featured` field.

---

### 5.2 Get single product (public)

**GET** `/api/products/:id`

**Auth:** Not required.

**Success (200):** Single product with full detail (including `imageUrls[]`, `jewelleryGemstones[]` for jewellery, `isCollectorPiece`, `isPrivilegeAssist`, `isPromotion`, etc.). Top-level fields **`createdAt`** and **`updatedAt`** are ISO 8601 strings (listing created / last updated). The response includes a `**seller`** object (or `null` if seller not found) with:


| Field             | Type          | Description                |
| ----------------- | ------------- | -------------------------- |
| `id`              | string        | Seller user ID             |
| `name`            | string        | Seller display name        |
| `phone`           | string | null | Seller phone (for contact) |
| `username`        | string | null | Seller username            |
| `displayUsername` | string | null | Seller display username    |


**Errors:**

- **404** – `{ "error": "Product not found" }`

---

### 5.3 My products (current user’s list)

**GET** `/api/products/mine`

**Auth:** Required. `Authorization: Bearer <session_token>`.

**Query:** Same parameters as **List all products** (see 5.1 and “Search and filter” below): `page`, `limit`, `search`, `productType`, `categoryId`, `status`, `stoneCut`, `shape`, `origin`, `laboratoryId`, `isCollectorPiece`, `isPrivilegeAssist`. All are optional. My products returns **all statuses** by default (seller sees full list); use `status` to filter.

**Examples:**

- `GET /api/products/mine?page=1&limit=20`
- `GET /api/products/mine?status=active&stoneCut=Cabochon` (with Bearer token)
- `GET /api/products/mine?isCollectorPiece=true` (with Bearer token)

**Success (200):** Same shape as “List all products”: `{ "products": [...], "total": n }` but only the logged-in user’s products.

**Errors:**

- **401** – `{ "error": "Unauthorized" }` — missing or invalid token.

---

### 5.4 Get profile (current user + their products)

**GET** `/api/profile`

**Auth:** Required. `Authorization: Bearer <session_token>`.

**Query (optional):** Same as **List all products** for the products list: `page`, `limit`, `search`, `productType`, `categoryId`, `stoneCut`, `shape`, `origin`, `laboratoryId`. Omit for default (page 1, limit 20). Note: the products list is **restricted to active products only**; the `status` query param does not override this.

**Success (200):**

```json
{
  "profile": {
    "id": "user-uuid",
    "name": "John Doe",
    "email": "user_09123456789@phone.local",
    "phone": "+959123456789",
    "role": "mobile",
    "username": "959123456789",
    "displayUsername": "John Doe",
    "nrc": null,
    "address": null,
    "city": null,
    "state": null,
    "country": null,
    "gender": null,
    "dateOfBirth": null,
    "points": 0,
    "emailVerified": false,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "products": {
    "products": [ { "id": "...", "title": "...", "price": "...", ... } ],
    "total": 42
  }
}
```

- **profile** – Current user’s profile (id, name, email, phone, role, username, displayUsername, nrc, address, city, state, country, gender, dateOfBirth, points, emailVerified, createdAt, updatedAt).
- **products** – Same shape as **GET /api/products/mine**: `{ "products": [...], "total": n }` for the current user’s **active** products only, with optional pagination/filters via query params.

**Errors:**

- **401** – `{ "error": "Unauthorized" }` — missing or invalid token.
- **404** – `{ "error": "Profile not found" }` — user record not found.

---

### 5.4a Get public seller profile (other user + their products)

**GET** `/api/profile/:id`

**Auth:** Not required.

Use this endpoint when a user opens another seller’s profile page and needs that seller’s active listings.

**Path params:**

| Param | Type   | Description            |
| ----- | ------ | ---------------------- |
| `id`  | string | Seller user id (UUID). |

**Query (optional):** Same filtering set as profile products: `page`, `limit`, `search`, `productType`, `categoryId`, `stoneCut`, `shape`, `origin`, `laboratoryId`, `isCollectorPiece`, `isPrivilegeAssist`, `isPromotion`. Products are always restricted to `status=active`.

**Success (200):**

```json
{
  "profile": {
    "id": "seller-uuid",
    "name": "Seller Name",
    "image": "https://.../avatar.jpg",
    "username": "seller_username",
    "displayUsername": "Seller Name",
    "createdAt": "2026-01-01T00:00:00.000Z"
  },
  "products": {
    "products": [ { "id": "...", "title": "...", "price": "...", ... } ],
    "total": 12
  }
}
```

- **profile** – Public-facing seller fields only (`id`, `name`, `image`, `username`, `displayUsername`, `createdAt`).
- **products** – Seller’s active listings with the same item shape as list endpoints.

**Errors:**

- **404** – `{ "error": "Profile not found" }`

---

### 5.4.1 Feature a product using points (mobile)

**POST** `/api/mobile/products/:id/feature`

**Auth:** Required. `Authorization: Bearer <session_token>`.

Use this endpoint when a seller chooses a feature duration plan in mobile and pays with points.

**Request body (JSON):**

```json
{
  "durationDays": 7,
  "points": 500
}
```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `durationDays` | number | Yes | Feature duration in days. Must match one configured tier. |
| `points` | number | Yes | Point cost. Must match the selected duration tier exactly. |

**Business rules:**

- Product must exist and belong to the logged-in user.
- `durationDays` + `points` must match a configured feature tier from admin feature settings.
- If user points are enough, backend deducts points from original balance and marks product as featured.
- If points are not enough, backend returns an error and does not update product.

**Success (200):**

```json
{
  "success": true,
  "productId": "product-uuid",
  "durationDays": 7,
  "pointsUsed": 500,
  "remainingPoints": 1200
}
```

**Errors:**

- **400** – `{ "error": "Invalid input" }`
- **400** – `{ "error": "Invalid duration or points tier" }`
- **400** – `{ "error": "Insufficient points balance" }`
- **401** – `{ "error": "Unauthorized" }`
- **403** – `{ "error": "Forbidden" }` (product not owned by current user)
- **404** – `{ "error": "Product not found" }`
- **500** – `{ "error": "Failed to apply featured option" }`

---

### 5.4.2 Get feature pricing tiers (mobile)

**GET** `/api/mobile/feature-pricing-tiers`

**Auth:** Not required.

Use this endpoint to load feature options for a picker/dropdown in mobile. It returns only tier options from `feature_pricing_tiers_json`.

**Success (200):**

```json
{
  "featurePricingTiers": [
    { "durationDays": 1, "points": 100 },
    { "durationDays": 3, "points": 270 },
    { "durationDays": 7, "points": 500, "badge": "Best Value" }
  ]
}
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `featurePricingTiers` | array | List of selectable tiers for feature purchase. |
| `durationDays` | number | Duration option in days. |
| `points` | number | Point cost for selected duration. |
| `badge` | string | Optional label (e.g. `Best Value`). |

**Errors:**

- **500** – `{ "error": "Failed to load feature pricing tiers" }`

---

### 5.4.3 Purchase points (mobile)

**POST** `/api/mobile/points/purchase`

**Auth:** Required. `Authorization: Bearer <session_token>`.

Use this endpoint when user buys points in the app. Backend converts purchase amount to points using current point settings and adds points to the user balance.

**Request body (JSON):**

```json
{
  "currency": "mmk",
  "amount": 100000
}
```

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `currency` | string | Yes | One of: `mmk`, `usd`, `krw`. |
| `amount` | number | Yes | Purchase amount in selected currency. Must be positive. |

**Business rules:**

- Conversion uses admin-configured point settings (`point-management` currency conversion).
- Calculated points are floored to integer.
- If calculated points <= 0, request is rejected.
- On success, points are added to original user balance.

**Success (200):**

```json
{
  "success": true,
  "currency": "mmk",
  "amount": 100000,
  "pointsAdded": 100,
  "pointsBalance": 1350
}
```

**Errors:**

- **400** – `{ "error": "Invalid input" }`
- **400** – `{ "error": "Point conversion is not configured" }`
- **400** – `{ "error": "Amount is too low to earn points" }`
- **401** – `{ "error": "Unauthorized" }`
- **500** – `{ "error": "Failed to purchase points" }`

---

### 5.5 Create product

**POST** `/api/products`

**Auth:** Required. Any registered user can create.

**Request body (JSON):** All fields except `title` and `price` are optional. Send only what you have.

**Required (all products):**

- `title` (string, 1–200 chars) – product name
- `price` (string or number, e.g. `"2500"` or `2500`)
- `identification` (string) – one of: `"Natural"`, `"Heat Treated"`, `"Treatments"`, `"Others"`

**Required when `productType` is `"loose_stone"` only:**

- `weightCarat` (string) – weight in carats (e.g. `"2.5"`)
- `color` (string, max 100) – e.g. Pigeon Blood Red
- `origin` (string, max 200) – e.g. Myanmar

**Optional (common):**

- `description` (string)
- `currency` – `"USD"` | `"MMK"` (default `"USD"`)
- `productType` – `"loose_stone"` | `"jewellery"` (default `"loose_stone"`)
- `categoryId` – UUID from `/api/categories`, or omit / send `null`
- `status` – `"active"` | `"archive"` | `"sold"` | `"hidden"`
- `imageUrls` – array of strings (image URLs). To get URLs: upload files via **POST /api/upload/product-media** with `type=image`, then use the returned `urls` here. Max 10 images per product.
- `videoUrls` – array of strings (video URLs). To get URLs: upload via **POST /api/upload/product-media** with `type=video`, then use the returned `urls` here. Max 5 videos per product.
- `isNegotiable` (boolean)
- `isFeatured` (boolean) – mark as featured
- `featured` (number) – points/priority for featured listing (integer >= 0). If sent as number, backend floors it.
- `featureDurationDays` (number) – featured duration in days (0–365). If `isFeatured=true` and `featureDurationDays > 0`, backend sets featured expiry time automatically.
- `isCollectorPiece` (boolean) – high-value collector piece (e.g. 1M+)
- `isPrivilegeAssist` (boolean) – product sold by us
- `isPromotion` (boolean) – mark as promotion item (also accepts `"true"` / `"1"` string)
- `promotionComparePrice` (string or number) – optional original price for promotions

**Loose stone:**

- `stoneCut` – `"Faceted"` | `"Cabochon"`
- `weightCarat`, `dimensions`, `color`, `shape`, `origin`
- `shape` – `"Oval"` | `"Cushion"` | `"Round"` | `"Pear"` | `"Heart"`
- `laboratoryId`, `certReportNumber`, `certReportDate`, `certReportUrl` (get URL by uploading via **POST /api/upload/certificate**; no manual URL field in admin form; certificate is shown in a viewer)

**Dimensions** (optional, loose stone **product** `dimensions` and each **jewellery** `jewelleryGemstones[].dimensions`):

The API stores a **single string**, matching the admin UI (three fields joined with ` × ` — Unicode multiply, spaces around).

You may send any of:

| Form | Example | Stored value |
|------|---------|----------------|
| String | `"8.2 × 6.5mm"` | unchanged (trimmed) |
| Array of parts | `["8.2mm", "6.5mm", "4mm"]` | `"8.2mm × 6.5mm × 4mm"` |
| Object L × W × D | `{ "length": "8.2", "width": "6.5", "depth": "4" }` | `"8.2 × 6.5 × 4"` |
| Third axis as `height` | `{ "length": "8", "width": "6", "height": "4mm" }` | `"8 × 6 × 4mm"` |
| Admin-style keys | `{ "part1": "8mm", "part2": "6mm", "part3": "4mm" }` | `"8mm × 6mm × 4mm"` |

- Max **300** characters after normalization.  
- Empty arrays / all-empty objects → `null`.  
- **PATCH** uses the same normalization when you send `dimensions` or `jewelleryGemstones`.

**Jewellery:**

- `metal` – `"Gold"` | `"Silver"` | `"Other"`
- `totalWeightGrams`
- `jewelleryGemstones` – array of gemstone objects (see **Jewellery with gemstones** below). Use the key `**jewelleryGemstones`** (lowercase `s`); `jewelleryGemStones` is not accepted. Product-level `color` and `origin` are not used for jewellery; each stone has its own `color` and `origin` in this array.

**Minimal example (all required fields):**

```json
{
  "title": "Blue Sapphire 2ct",
  "price": "2500",
  "identification": "Natural",
  "weightCarat": "2",
  "color": "Blue",
  "origin": "Myanmar",
  "currency": "USD",
  "productType": "loose_stone"
}
```

**With more fields:**

```json
{
  "title": "Blue Sapphire 2ct",
  "description": "Natural blue sapphire, heated.",
  "price": "2500",
  "currency": "USD",
  "productType": "loose_stone",
  "categoryId": "category-uuid-from-api",
  "stoneCut": "Faceted",
  "weightCarat": "2",
  "color": "Blue",
  "shape": "Oval",
  "origin": "Myanmar",
  "dimensions": ["8.2mm", "6.5mm", "4.1mm"],
  "status": "active",
  "imageUrls": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
}
```

*(The `dimensions` array above is stored as `"8.2mm × 6.5mm × 4.1mm"`.)*

**Jewellery with gemstones (seller create)**

For `productType: "jewellery"` you can send one or more stones in `jewelleryGemstones`. Each item describes one gemstone type in the piece (e.g. centre ruby + side diamonds).

Get valid category IDs from **GET /api/categories** (use `?type=jewellery` or `?type=loose_stone` depending on how your backend defines gem categories — e.g. Ruby, Sapphire, Diamond).

**Each `jewelleryGemstones` item:**


| Field          | Required | Type             | Description                                                       |
| -------------- | -------- | ---------------- | ----------------------------------------------------------------- |
| `categoryId`   | Yes      | string (UUID)    | Category of the gem (e.g. Ruby, Diamond). From `/api/categories`. |
| `weightCarat`  | Yes      | string           | Total weight in carats for this stone type (e.g. `"1.5"`).        |
| `pieceCount`   | No       | number or string | Number of stones of this type (e.g. 37 for “Ruby: 37 pcs”).       |
| `dimensions`   | No       | string, string[], or object | Same rules as product-level **Dimensions** above (stored as one string, e.g. `"5 × 3mm"`). |
| `color`        | Yes      | string           | e.g. `"Red"`, `"White"`. Required for each jewellery gemstone.    |
| `shape`        | No       | string           | `"Oval"` | `"Cushion"` | `"Round"` | `"Pear"` | `"Heart"`.        |
| `origin`       | Yes      | string           | e.g. `"Myanmar"`. Required for each jewellery gemstone.           |
| `cut`          | No       | string           | Cut style (e.g. `"Brilliant"`, `"Step"`).                         |
| `transparency` | No       | string           | e.g. `"Transparent"`.                                             |
| `comment`      | No       | string           | Lab comment.                                                      |
| `inclusions`   | No       | string           | e.g. `"Rutiles, feathers"`.                                       |


**Sample: jewellery product with gemstones (create by seller)**

Example: a ring with one ruby (centre) and multiple diamonds (side stones). Replace `CATEGORY_UUID_RUBY` and `CATEGORY_UUID_DIAMOND` with real IDs from `GET /api/categories`.

```json
{
  "title": "18K Gold Ruby & Diamond Ring",
  "description": "Classic solitaire-style ring with natural ruby centre and diamond accents. Lab report available.",
  "identification": "Natural",
  "price": "8500",
  "currency": "USD",
  "productType": "jewellery",
  "categoryId": "CATEGORY_UUID_RING",
  "metal": "Gold",
  "totalWeightGrams": "4.2",
  "isNegotiable": true,
  "status": "active",
  "imageUrls": [
    "https://example.com/ring-front.jpg",
    "https://example.com/ring-side.jpg",
    "https://example.com/ring-cert.jpg"
  ],
  "jewelleryGemstones": [
    {
      "categoryId": "CATEGORY_UUID_RUBY",
      "weightCarat": "1.25",
      "pieceCount": 1,
      "dimensions": "6x5mm",
      "color": "Red",
      "shape": "Oval",
      "origin": "Myanmar",
      "cut": "Mixed cut",
      "transparency": "Transparent",
      "comment": "No indication of thermal treatment"
    },
    {
      "categoryId": "CATEGORY_UUID_DIAMOND",
      "weightCarat": "0.45",
      "pieceCount": 12,
      "dimensions": "2mm",
      "color": "White",
      "origin": "Lab-grown",
      "shape": "Round",
      "cut": "Brilliant"
    }
  ]
}
```

**Minimal jewellery with one gemstone:**

```json
{
  "title": "Ruby & Diamond Ring",
  "price": "5000",
  "identification": "Natural",
  "productType": "jewellery",
  "metal": "Gold",
  "totalWeightGrams": "5.2",
  "jewelleryGemstones": [
    {
      "categoryId": "category-uuid-from-api",
      "weightCarat": "1.5",
      "color": "Red",
      "origin": "Myanmar",
      "shape": "Oval"
    }
  ],
  "imageUrls": ["https://example.com/ring.jpg"]
}
```

**Success (201):**

```json
{
  "success": true,
  "productId": "uuid"
}
```

**Errors:**

- **400** – Validation failed. Body: `{ "error": "message", "details": { "field": ["error"] } }`
- **401** – `{ "error": "Unauthorized" }`

---

### 5.6 Update product

**PATCH** `/api/products/:id`

**Auth:** Required. User can update **only their own** product (or admin can update any).

**Request body (JSON):** Same fields as create; all optional. Send only fields you want to change. Includes optional featured fields (`isFeatured`, `featured`, `featureDurationDays`) and promotion fields (`isPromotion`, `promotionComparePrice`). You can update **status** here (e.g. **mark as sold** with `{ "status": "sold" }`) — see **5.6.1 Status update (e.g. Mark as sold)**.

**Example:** Change title and price only.

```json
{
  "title": "Updated title",
  "price": "3000"
}
```

**Success (200):**

```json
{
  "success": true,
  "productId": "uuid"
}
```

**Errors:**

- **400** – Validation error (see `error` and `details`).
- **401** – Not logged in.
- **403** – `{ "error": "Forbidden" }` — not the owner and not admin.
- **404** – Product not found.

---

### 5.6.1 Status update (e.g. Mark as sold)

Product **status** controls listing visibility and seller workflow. Only the **owner** (or admin) can change status via **PATCH** `/api/products/:id`.

**Status values (API):**


| API value | UI / meaning | Description                                                |
| --------- | ------------ | ---------------------------------------------------------- |
| `active`  | Active       | Listed and visible to buyers. Default for new products.    |
| `hidden`  | Reserved     | Not shown in public list (e.g. reserved for a buyer).      |
| `sold`    | Sold         | Item sold; seller marks as sold when the sale is complete. |
| `archive` | Archived     | No longer for sale; kept for history.                      |


**Mark as sold (seller)**

When a seller completes a sale, the app should call:

**PATCH** `/api/products/:id`

**Request body:**

```json
{
  "status": "sold"
}
```

**Auth:** Required. Must be the product owner (or admin).

**Success (200):** `{ "success": true, "productId": "uuid" }`

**Other status updates**

Same endpoint; send only the fields you change. Examples:

- Reserve listing: `{ "status": "hidden" }`
- Put back on market: `{ "status": "active" }`
- Archive: `{ "status": "archive" }`

Public list (**GET /api/products**) returns **active** products only by default. Sellers see all statuses in **GET /api/products/mine** (optionally filter with query `?status=sold`, etc.).

---

### 5.7 Delete product

**DELETE** `/api/products/:id`

**Auth:** Required. User can delete **only their own** product (or admin can delete any).

**Success (200):**

```json
{
  "success": true
}
```

**Errors:**

- **401** – Not logged in.
- **403** – Not the owner and not admin.
- **404** – Product not found.

---

## 6. News (read-only)

News items are managed in the admin; the mobile app can list and read **published** news. No auth required.

### 6.1 List news (public)

**GET** `/api/news`

**Auth:** Not required.

**Query:**


| Param    | Type   | Default     | Description                                                               |
| -------- | ------ | ----------- | ------------------------------------------------------------------------- |
| `page`   | number | 1           | Page number (1-based).                                                    |
| `limit`  | number | 20          | Items per page (max 100).                                                 |
| `status` | string | `published` | Filter by status: `published` or `draft`. Default returns only published. |


**Examples:**

- First page (published only): `GET /api/news`
- With pagination: `GET /api/news?page=2&limit=10`
- Drafts (if needed for internal use): `GET /api/news?status=draft`

**Success (200):**

```json
{
  "news": [
    {
      "id": "uuid",
      "title": "News title",
      "content": "[]",
      "status": "published",
      "publish": "2025-01-15T00:00:00.000Z",
      "createdAt": "2025-01-10T12:00:00.000Z",
      "updatedAt": "2025-01-15T00:00:00.000Z"
    }
  ],
  "total": 42
}
```

- **news:** Array of news items (ordered by publish date, then updatedAt).
- **total:** Total number of items matching the filter (for pagination).
- **content:** Stored as JSON (e.g. BlockNote document); parse in the app if needed for rich text.

---

### 6.2 Get single news (public)

**GET** `/api/news/:id`

**Auth:** Not required.

Returns a single published news item by ID. Draft items return **404**.

**Success (200):** Single news object.

```json
{
  "id": "uuid",
  "title": "News title",
  "content": "[]",
  "status": "published",
  "publish": "2025-01-15T00:00:00.000Z",
  "createdAt": "2025-01-10T12:00:00.000Z",
  "updatedAt": "2025-01-15T00:00:00.000Z"
}
```

**Errors:**

- **404** – `{ "error": "News not found" }` (invalid id or item is draft).

---

## 7. Articles (read-only)

Articles are managed in the admin; the mobile app can list and read **published** articles. No auth required.

### 7.1 List articles (public)

**GET** `/api/articles`

**Auth:** Not required.

**Query:**


| Param    | Type   | Default     | Description                                                               |
| -------- | ------ | ----------- | ------------------------------------------------------------------------- |
| `page`   | number | 1           | Page number (1-based).                                                    |
| `limit`  | number | 20          | Items per page (max 100).                                                 |
| `status` | string | `published` | Filter by status: `published` or `draft`. Default returns only published. |


**Examples:**

- First page (published only): `GET /api/articles`
- With pagination: `GET /api/articles?page=2&limit=10`

**Success (200):**

```json
{
  "articles": [
    {
      "id": "uuid",
      "title": "Article title",
      "slug": "article-slug",
      "content": "[]",
      "author": "Author name",
      "status": "published",
      "publishDate": "2025-01-15T00:00:00.000Z",
      "createdAt": "2025-01-10T12:00:00.000Z",
      "updatedAt": "2025-01-15T00:00:00.000Z"
    }
  ],
  "total": 42
}
```

- **articles:** Array of articles (ordered by publishDate, then updatedAt).
- **total:** Total number of items matching the filter (for pagination).
- **content:** Stored as JSON (e.g. BlockNote document); parse in the app for rich text.
- **slug:** URL-friendly identifier; can be used for SEO or detail routes.

---

### 7.2 Get single article (public)

**GET** `/api/articles/:id`

**Auth:** Not required.

Returns a single published article by ID. Draft items return **404**.

**Success (200):** Single article object.

```json
{
  "id": "uuid",
  "title": "Article title",
  "slug": "article-slug",
  "content": "[]",
  "author": "Author name",
  "status": "published",
  "publishDate": "2025-01-15T00:00:00.000Z",
  "createdAt": "2025-01-10T12:00:00.000Z",
  "updatedAt": "2025-01-15T00:00:00.000Z"
}
```

**Errors:**

- **404** – `{ "error": "Article not found" }` (invalid id or item is draft).

---

## 8. Quick flow for React Native

1. **Auth**
  - Call `POST /api/mobile/register` or `POST /api/mobile/login`.
  - From the response, read and store the session token (exact key depends on better-auth response; often `session.token` or similar).
  - On every protected request, set header: `Authorization: Bearer <stored_token>`.
  - Load feature options: call `GET /api/mobile/feature-pricing-tiers` and let user select `durationDays` + `points`.
  - To buy points (top-up): call `POST /api/mobile/points/purchase` with `currency` and `amount`.
  - To feature with points: call `POST /api/mobile/products/:id/feature` with selected `durationDays` and `points`.
2. **Categories**
  - On app load or before “Add product”: `GET /api/categories` (optionally with `?type=loose_stone` or `?type=jewellery`).
  - Cache the list; use for dropdowns and for `categoryId` when creating/editing products.
3. **Browse**
  - List: `GET /api/products?page=1&limit=20` (optional: `search`, `productType`, `categoryId`, `status`, `stoneCut`, `shape`, `origin`, `laboratoryId`, `isCollectorPiece`, `isPrivilegeAssist`). Public list defaults to active only.
  - Detail: `GET /api/products/:id`.
  - Seller profile (public): `GET /api/profile/:id` to show another seller and their active products.
4. **My products**
  - List: `GET /api/products/mine?page=1&limit=20` (same optional query params as browse, including `isCollectorPiece`, `isPrivilegeAssist`; with Bearer token). Returns all statuses by default.
5. **Profile**
  - Get profile and own products: `GET /api/profile` (optional: `?page=1&limit=20` and same filter params; with Bearer token).
6. **Sell**
  - **Upload media first (optional):**
    - **Images (simple):** `POST /api/upload/product-media` with `type=image` and `file`/`files` (multipart/form-data, Bearer token) → `{ "urls": ["..."] }` → use as `imageUrls`.
    - **Videos (recommended):** Use **direct-to-Supabase** signed upload:
      - `POST /api/upload/product-media/sign` (JSON, Bearer token) → `{ bucket, path, token, publicUrl }`
      - Upload to Supabase with `uploadToSignedUrl(path, token, ...)`
      - Use `publicUrl` as `videoUrls`
    - **Certificate:** `POST /api/upload/certificate` with `file` (multipart) → `{ "url": "..." }` → use as `certReportUrl`.
  - Create: `POST /api/products` with JSON body including `imageUrls` / `videoUrls` / `certReportUrl` if you uploaded files (with Bearer token).
  - Edit: `PATCH /api/products/:id` (with Bearer token).
  - Delete: `DELETE /api/products/:id` (with Bearer token).
7. **News**
  - List: `GET /api/news?page=1&limit=20` (optional: `?status=published` or `?status=draft`).
  - Detail: `GET /api/news/:id` (returns 404 for drafts).
8. **Articles**
  - List: `GET /api/articles?page=1&limit=20` (optional: `?status=published` or `?status=draft`).
  - Detail: `GET /api/articles/:id` (returns 404 for drafts).

---

## 9. Error format

- **Body:** `{ "error": "Human-readable message" }`.
- **Validation (400):** May also include `details`: `{ "fieldName": ["error message"] }`.
- **Status codes:** `400` bad input, `401` not logged in, `403` not allowed, `404` not found, `500` server error.

---

## 10. Summary table


| Method | Path                   | Auth | Description                                                                                                 |
| ------ | ---------------------- | ---- | ----------------------------------------------------------------------------------------------------------- |
| POST   | `/api/mobile/register` | No   | Register                                                                                                    |
| POST   | `/api/mobile/login`    | No   | Login                                                                                                       |
| GET    | `/api/mobile/feature-pricing-tiers` | No   | Get feature duration/points tier options for mobile select UI.                                              |
| POST   | `/api/mobile/products/:id/feature` | Yes  | Feature product using points (deducts balance if enough; 400 on insufficient balance).                      |
| POST   | `/api/mobile/points/purchase` | Yes  | Purchase points and add to user balance based on configured conversion.                                      |
| GET    | `/api/categories`      | No   | List categories (`?type` optional)                                                                          |
| GET    | `/api/origins`         | No   | List origins (for product create/edit)                                                                     |
| GET    | `/api/laboratories`    | No   | List laboratories (for product create/edit)                                                                 |
| POST   | `/api/upload/product-media` | Yes  | Upload product images or videos (multipart); returns URLs for imageUrls/videoUrls. See 4.4.                 |
| POST   | `/api/upload/product-media/sign` | Yes  | Generate signed upload token for direct-to-Supabase media uploads (use `publicUrl` in product payload). Auth required.                 |
| POST   | `/api/upload/certificate`   | Yes  | Upload one certificate file (PDF/image); returns url for certReportUrl. See 4.5.                          |
| GET    | `/api/products`        | No   | List products (default active only; see 5.1 for query params including isCollectorPiece, isPrivilegeAssist) |
| GET    | `/api/products/:id`    | No   | Get one product                                                                                             |
| GET    | `/api/products/mine`   | Yes  | List my products (all statuses by default; same query params as list all)                                   |
| GET    | `/api/profile`         | Yes  | Get profile and own products (optional query params)                                                        |
| GET    | `/api/profile/:id`     | No   | Get public seller profile and active products (optional query params)                                       |
| POST   | `/api/products`        | Yes  | Create product                                                                                              |
| PATCH  | `/api/products/:id`    | Yes  | Update (owner/admin)                                                                                        |
| DELETE | `/api/products/:id`    | Yes  | Delete (owner/admin)                                                                                        |
| GET    | `/api/news`            | No   | List news (`?page`, `?limit`, `?status`)                                                                    |
| GET    | `/api/news/:id`        | No   | Get one news (published only)                                                                               |
| GET    | `/api/articles`        | No   | List articles (`?page`, `?limit`, `?status`)                                                                |
| GET    | `/api/articles/:id`    | No   | Get one article (published only)                                                                            |



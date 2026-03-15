# Technical Documentation: Products and Related Features

**Convention:** When you add or change logic, algorithms, or function-level behaviour, document it here (or in the relevant technical doc). See [docs/README.md](./README.md).

---

This document describes the product domain: database schema, validation, business logic, file/video upload flow, and key functions. It focuses on products and their related usage (images, videos, media limits, and API behaviour).

---

## 1. Database schema

### 1.1 Enums (product domain)

Defined in `drizzle/schema/product-schema.ts`:

| Enum | Values | Purpose |
|------|--------|---------|
| `product_status` | `active`, `archive`, `sold`, `hidden` | Listing visibility and seller workflow (Active / Reserved / Sold / Archived). |
| `product_moderation` | `pending`, `approved`, `rejected` | Admin moderation state. |
| `currency` | `USD`, `MMK` | Price currency. |
| `product_shape` | `Oval`, `Cushion`, `Round`, `Pear`, `Heart` | Stone shape. |
| `stone_cut` | `Faceted`, `Cabochon` | Loose stone cut style. |
| `metal` | `Gold`, `Silver`, `Other` | Jewellery metal. |
| `product_identification` | `Natural`, `Heat Treated`, `Treatments`, `Others` | Treatment/identification type. |
| `product_type` | `loose_stone`, `jewellery` | From category schema; product inventory type. |

### 1.2 Table: `product`

Stores the core product row. One product belongs to one category, one seller (user), and optionally one laboratory.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default random | Product identifier. |
| `sku` | text | unique | Stock-keeping unit; generated from category short code + random suffix. |
| `title` | text | not null | Product title. |
| `description` | text | | Long description. |
| `identification` | enum | default `Natural` | Treatment/identification. |
| `price` | decimal(14,2) | not null | Price. |
| `currency` | enum | default `USD` | Currency. |
| `is_negotiable` | boolean | default false | Whether price is negotiable. |
| `product_type` | enum | default `loose_stone` | `loose_stone` or `jewellery`. |
| `category_id` | uuid | FK → category, on delete set null | Required on create; used for SKU prefix. |
| `stone_cut` | enum | | Loose stone: Faceted / Cabochon. |
| `metal` | enum | | Jewellery: Gold / Silver / Other. |
| `total_weight_grams` | decimal(12,4) | | Jewellery: total piece weight. |
| `weight_carat` | decimal(10,4) | | Loose stone weight (carat). |
| `dimensions` | text | | Dimensions (e.g. L×W×H). |
| `color` | text | | Color. |
| `shape` | enum | | Shape. |
| `origin` | text | | Origin. |
| `cert_lab_name` | text | | Lab name (cert). |
| `laboratory_id` | uuid | FK → laboratory, on delete set null | Lab reference. |
| `cert_report_number` | text | | Report number. |
| `cert_report_date` | text | | Report date. |
| `cert_report_url` | text | | Certificate file URL (from upload; no manual URL input). |
| `status` | enum | default `active` | active / archive / sold / hidden. |
| `moderation_status` | enum | default `pending` | pending / approved / rejected. |
| `is_featured` | boolean | default false | Featured flag. |
| `featured` | integer | default 0 | Featured sort order. |
| `is_collector_piece` | boolean | default false | Collector piece flag. |
| `is_privilege_assist` | boolean | default false | Privilege Assist flag. |
| `seller_id` | text | not null, FK → user, on delete cascade | Owner. |
| `created_at` | timestamp | default now | Creation time. |
| `updated_at` | timestamp | default now, on update now | Last update. |

Indexes: `sellerId`, `productType`, `categoryId`, `status`, `moderationStatus`, `featured`, `currency`, `sku`, `weightCarat`, `shape`, `isFeatured`, `isCollectorPiece`, `isPrivilegeAssist`, `laboratoryId`.

### 1.3 Table: `product_image`

One row per product image URL; order by `sort_order`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default random | Row id. |
| `product_id` | uuid | not null, FK → product, on delete cascade | Product. |
| `url` | text | not null | Image URL (e.g. Supabase Storage public URL). |
| `sort_order` | integer | default 0 | Display order. |
| `created_at` | timestamp | default now | Creation time. |

Index: `product_image_productId_idx`.

### 1.4 Table: `product_video`

One row per product video URL; order by `sort_order`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default random | Row id. |
| `product_id` | uuid | not null, FK → product, on delete cascade | Product. |
| `url` | text | not null | Video URL. |
| `sort_order` | integer | default 0 | Display order. |
| `created_at` | timestamp | default now | Creation time. |

Index: `product_video_productId_idx`.

### 1.5 Product search (full-text and suggestions)

**Full-text search:** List endpoints (`getAdminProductsFromDb`, used by GET /api/products and admin) use Postgres full-text search when a `search` param is present: `to_tsvector('english', title || ' ' || description)` and `plainto_tsquery('english', search)`, with ranking by `ts_rank`. Seller name/phone/email remain matched via ILIKE (with escaped `%`/`_`/`\`). To enable fast FTS, run **scripts/postgres-fulltext-search.sql** once (e.g. Supabase SQL Editor or psql). It creates a GIN index `product_title_description_fts_idx` on the tsvector expression.

**Suggestions:** `getProductSearchSuggestions(q, limit)` returns distinct product titles for autocomplete (GET /api/products/suggestions). Only active products; ordered by title starts-with query, then contains, then newest. Input `q` is escaped for ILIKE.

**Ranking rules:**
- **Product list (with search):** When `search` is present and sort is public priority, order is: (1) `ts_rank` (FTS relevance) descending, (2) collector piece, (3) privilege assist, (4) featured, (5) `createdAt` descending. Without search, order is collector / privilege / featured / createdAt only.
- **Suggestions:** (1) Title starts with query (DESC), (2) title contains query (DESC), (3) `createdAt` DESC. Duplicate titles are collapsed; first occurrence in this order is kept.

**Caching:** GET /api/products uses default public cache (60s s-maxage, 300s stale-while-revalidate). GET /api/products/suggestions uses shorter cache (30s s-maxage, 60s stale-while-revalidate). Query params are part of the cache key. Rate limiting for search and suggestions is recommended (per-IP or per-user) to prevent abuse; see docs/SECURITY.md if present.

#### 1.5.1 Code reference: search and suggestions

**Beginner-friendly line-by-line guide:** [CODE-SEARCH-SUGGESTIONS.md](./CODE-SEARCH-SUGGESTIONS.md) — tables and explanations for the route, list search, and `getProductSearchSuggestions`. Update that doc when you change this code.

**Files:** `app/api/products/suggestions/route.ts`, `features/products/db/products.ts`.

**Suggestions route (`app/api/products/suggestions/route.ts`):**
- `connection()` — marks the route as dynamic (no static prerender).
- `searchParams.get("q")?.trim() ?? ""` — read and normalize query; empty string if missing.
- `limit` — parsed from query, clamped to 1–10; default 5.
- If `q.length < 2`: return `{ suggestions: [] }` with cache headers (no DB call).
- Otherwise: `getProductSearchSuggestions(q, limit)` then return `{ suggestions }` with `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`.
- Errors: 500 with `jsonError(...)` (no-store so errors are not cached).

**`escapeLike(s)` (products.ts):** Escapes `\`, `%`, and `_` in user input so they are not treated as SQL LIKE wildcards (safe ILIKE patterns).

**List search (`getAdminProductsFromDb`):**
- `searchCondition`: when `search` is set, an OR of (1) full-text match: `to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')) @@ plainto_tsquery('english', search)`, (2) ILIKE on product title and seller name/phone/email using `escapeLike(search)`.
- `orderByColumns`: when `sortByPublicPriority` and `search` are set, order by `ts_rank(...)` DESC first, then collector piece, privilege assist, featured, `createdAt` DESC.

**`getProductSearchSuggestions(q, limit)` (products.ts):**
- Normalize `q` (trim); return `[]` if length < 2.
- Clamp `limit` to 1–10; build `patternContains` = `%${escapeLike(q)}%` and `patternStarts` = `${escapeLike(q)}%`.
- Query: `product` table, `status = 'active'`, `title ILIKE patternContains`; select only `title`, `createdAt`; order by `(title ILIKE patternStarts) DESC`, `(title ILIKE patternContains) DESC`, `createdAt DESC`; limit 50.
- In application code: iterate rows, skip duplicate titles (Set), push `{ label: row.title }` until result length reaches requested limit (cap), then return.

### 1.6 Table: `product_jewellery_gemstone`

Jewellery only: one row per gemstone type on the piece (e.g. Ruby 0.5ct).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default random | Row id. |
| `product_id` | uuid | not null, FK → product, on delete cascade | Product. |
| `category_id` | uuid | not null, FK → category, on delete cascade | Stone category. |
| `piece_count` | integer | | Number of stones of this type. |
| `weight_carat` | decimal(10,4) | not null | Total carat for this type. |
| `dimensions` | text | | Dimensions. |
| `color` | text | | Color. |
| `shape` | enum | | Shape. |
| `origin` | text | | Origin. |
| `cut` | text | | Cut description. |
| `transparency` | text | | Transparency. |
| `comment` | text | | Comment. |
| `inclusions` | text | | Inclusions. |

Index: `product_jewellery_gemstone_productId_idx`.

### 1.6 Relations

- **product** → one category, one laboratory, one seller (user); many productImage, many productJewelleryGemstone; productVideo table exists and is queried by `productId` (relation can be added as `videos: many(productVideo)`).
- **product_image** → one product.
- **product_video** → one product.
- **product_jewellery_gemstone** → one product, one category.

---

## 2. Validation schemas (Zod)

Location: `features/products/schemas/products.ts`.

### 2.1 Base create schema (`productCreateBaseSchema`)

- **title**: string, min 1, max 200.
- **sku**: optional, max 50.
- **description**: optional, max 5000.
- **identification**: enum, default `Natural`.
- **price**: string, refined to non‑negative number.
- **currency**: enum, default `USD`.
- **productType**: `loose_stone` | `jewellery`, default `loose_stone`.
- **categoryId**: required string, UUID (required on create).
- **stoneCut**, **metal**: optional enums.
- **jewelleryGemstones**: optional string → transformed to array via `JSON.parse` and `jewelleryGemstoneItemSchema.safeParse` per item.
- **totalWeightGrams**, **weightCarat**: optional string, refined to non‑negative number or empty.
- **dimensions**, **color**, **shape**, **origin**: optional strings (with max lengths).
- **laboratoryId**: optional string → UUID or null.
- **certReportNumber**, **certReportDate**, **certReportUrl**: optional strings.
- **status**: optional product status enum.
- **isFeatured**, **isCollectorPiece**, **isPrivilegeAssist**: optional booleans.
- **imageUrls**: optional string → split by newline or comma, trimmed, non‑empty → string[].
- **videoUrls**: same transform as imageUrls → string[].

### 2.2 Create schema (`productCreateSchema`)

- Extends base with two `superRefine` steps:
  1. **Loose stone**: requires `weightCarat`, `color`, `origin` (non‑empty) when `productType === "loose_stone"`.
  2. **Media limits**: `imageUrls.length` ≤ 10, `videoUrls.length` ≤ 5; otherwise adds custom issue on `imageUrls` or `videoUrls`.

Constants: `MAX_PRODUCT_IMAGES = 10`, `MAX_PRODUCT_VIDEOS = 5`.

### 2.3 Update schema (`productUpdateSchema`)

- `productCreateBaseSchema.partial()` plus required `productId` (UUID).
- Same media-limit `superRefine`: when `imageUrls` or `videoUrls` are present, length must be ≤ 10 and ≤ 5 respectively.

---

## 3. Normalize API body

**Function:** `normalizeProductBody(body: unknown): Record<string, unknown>`  
**File:** `features/products/api/normalize-product-body.ts`

**Purpose:** Convert JSON API payloads (e.g. from mobile) into the shape expected by the Zod schemas (which expect newline‑separated strings for URL lists and stringified JSON for jewellery gemstones).

**Logic:**

1. If `body` is not a non-null object, return `{}`.
2. Shallow copy `body` to `out`.
3. If `body.jewelleryGemstones` is an array → `out.jewelleryGemstones = JSON.stringify(body.jewelleryGemstones)`.
4. If `body.imageUrls` is an array → `out.imageUrls = (body.imageUrls as string[]).join("\n")`.
5. If `body.videoUrls` is an array → `out.videoUrls = (body.videoUrls as string[]).join("\n")`.
6. If `body.price` is a number → `out.price = String(body.price)`.
7. Return `out`.

Used by: `POST /api/products`, `PATCH /api/products/:id` before parsing with `productCreateSchema` / `productUpdateSchema`.

---

## 4. Product DB layer (core functions)

**File:** `features/products/db/products.ts`.

### 4.1 SKU generation

**Function:** `generateSku(shortCode: string): string` (internal)

**Algorithm:**

1. `prefix = shortCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")` or `"PRD"` if empty.
2. `id = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()`.
3. Return `prefix + "-" + id` (e.g. `RUBY-5EE3A8CE04`).

Used when inserting a new product (SKU required from category short code) or when updating a product that has no SKU.

### 4.2 Create product

**Function:** `createProductInDb(input: CreateProductInput): Promise<string>`

**Input type:** `ProductCreate` (from schema) plus `sellerId: string` and `categoryId: string`.

**Algorithm:**

1. Load category row by `input.categoryId`; if no `shortCode`, throw.
2. Generate `sku = generateSku(categoryRow.shortCode)`.
3. Build product insert object from `input` (no imageUrls, videoUrls, jewelleryGemstones).
4. `INSERT INTO product` with that object; get `productId` from `returning`.
5. If `input.imageUrls` has length > 0: `INSERT INTO product_image` one row per URL with `productId`, `url`, `sortOrder = 0,1,2,...`.
6. If `input.videoUrls` has length > 0: `INSERT INTO product_video` one row per URL with `productId`, `url`, `sortOrder = 0,1,2,...`.
7. If `input.jewelleryGemstones` has length > 0: `INSERT INTO product_jewellery_gemstone` one row per gemstone with product and category fields.
8. Return `productId`.

Images and videos are stored only in the child tables; the product row does not store URL arrays.

### 4.3 Update product

**Function:** `updateProductInDb(id: string, input: UpdateProductInput): Promise<void>`

**Algorithm:**

1. Destructure `imageUrls`, `videoUrls`, `jewelleryGemstones` from `input`; rest go to product columns.
2. Build `updates` for the product table from `rest` (only defined fields). If `sku` is not in updates and current row has no SKU, compute SKU from category (short code) and set `updates.sku`.
3. If `updates` is non-empty: `UPDATE product SET ... WHERE id = id`.
4. If `jewelleryGemstones !== undefined`: `DELETE FROM product_jewellery_gemstone WHERE product_id = id`; then if array length > 0, `INSERT` all gemstone rows for this product.
5. If `imageUrls !== undefined`: `DELETE FROM product_image WHERE product_id = id`; then if array length > 0, `INSERT` all image rows (url, sortOrder 0,1,...).
6. If `videoUrls !== undefined`: `DELETE FROM product_video WHERE product_id = id`; then if array length > 0, `INSERT` all video rows (url, sortOrder 0,1,...).

Update is “replace all” for images, videos, and jewellery gemstones when those keys are present.

### 4.4 Get product by ID

**Function:** `getProductById(id: string): Promise<ProductForEdit | null>`

Returns a single product with:

- All product columns.
- `imageUrls`: string[] from `product_image` ordered by `sort_order`.
- `videoUrls`: string[] from `product_video` ordered by `sort_order`.
- `jewelleryGemstones`: array of gemstone rows (with category name if joined).

Queries product, then product_image, then product_video, then product_jewellery_gemstone (with category), then assembles the result. Returns null if product not found.

### 4.5 Delete product

**Function:** `deleteProductInDb(id: string): Promise<boolean>`

`DELETE FROM product WHERE id = id`; returns true if a row was deleted (cascade removes product_image, product_video, product_jewellery_gemstone).

---

## 5. File and video upload (Supabase Storage)

### 5.1 Supabase server client

**File:** `lib/supabase/server.ts`.

**Functions:**

- **getSupabaseAdmin(): SupabaseClient | null**  
  - Reads `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY`.  
  - If either missing, returns null.  
  - If `NEXT_PUBLIC_SUPABASE_ANON_KEY` equals `SUPABASE_SERVICE_ROLE_KEY`, returns null (prevents using anon key as service role).  
  - Otherwise returns `createClient(url, serviceKey, { auth: { persistSession: false } })`.

- **getSupabaseAdminErrorMessage(): string**  
  - Returns a user-facing message when `getSupabaseAdmin()` is null (missing env vs “use service_role, not anon”).

**Constants:** `PRODUCT_IMAGES_BUCKET = "product-images"`, `PRODUCT_VIDEOS_BUCKET = "product-videos"`, `PRODUCT_CERTIFICATES_BUCKET = "product-certificates"`.

### 5.2 Upload API route (images and videos)

**Route:** `POST /api/upload/product-media`  
**File:** `app/api/upload/product-media/route.ts`.

**Auth:** Requires session (`auth.api.getSession` from request headers); 401 if no `session?.user?.id`. Used by both the **admin product form** (browser) and the **mobile API** (React Native or any client sending `Authorization: Bearer <session_token>`).

**Request:** `FormData`:

- `type`: `"image"` or `"video"` (required).
- `files`: multiple files, or `file`: single file.

**Constants:**

- Allowed image types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`. Max size 10 MB.
- Allowed video types: `video/mp4`, `video/webm`, `video/quicktime`. Max size 100 MB.

**Algorithm:**

1. Get session; if missing → 401.
2. `supabase = getSupabaseAdmin()`; if null → 503 with `getSupabaseAdminErrorMessage()`.
3. Parse FormData: validate `type` ∈ {`image`, `video`}; collect File(s) from `files` or `file`; if none → 400.
4. Set bucket and allowed types/size from `type`.
5. For each file:
   - Reject if MIME not in allowed list or size > max → 400.
   - Path: `{session.user.id}/{uuid}.{ext}`.
   - Convert file to ArrayBuffer; `supabase.storage.from(bucket).upload(path, arrayBuffer, { contentType, upsert: false })`.
   - On Storage error: if message suggests RLS, return “use service_role key” message; else return error message → 500.
   - On success: `getPublicUrl(path)` and push to `urls`.
6. Return `{ urls: string[] }`.

Only authenticated users can upload; the server uses the service role key so Storage RLS must allow the service role (see `scripts/supabase-storage-policies.sql`).

### 5.3 Certificate upload API route (lab report)

**Route:** `POST /api/upload/certificate`  
**File:** `app/api/upload/certificate/route.ts`.

**Auth:** Same as 5.2 (session from headers; used by admin form and mobile).

**Request:** `FormData` with single field `file` (one file).

**Constants:**

- Allowed types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `image/gif`. Max size 10 MB.
- Bucket: `PRODUCT_CERTIFICATES_BUCKET` (`product-certificates`). Create this bucket in Supabase Dashboard > Storage (e.g. public) and run the RLS script so service_role has full access.

**Algorithm:**

1. Get session; if missing → 401.
2. `supabase = getSupabaseAdmin()`; if null → 503.
3. Get single file from FormData key `file`; if not a File → 400.
4. Validate MIME and size; on failure → 400.
5. Path: `{session.user.id}/{uuid}.{ext}`; upload to `product-certificates` bucket.
6. On success return `{ url: publicUrl }` (single URL for product `certReportUrl`).

---

## 6. Product form (client): upload and limits

**File:** `features/products/components/ProductForm.tsx`.

### 6.1 Constants

- `MAX_PRODUCT_IMAGES = 10`
- `MAX_PRODUCT_VIDEOS = 5`

### 6.2 State

- `imageUrlsList`, `videoUrlsList`: string[] (controlled; synced from `product?.imageUrls` / `product?.videoUrls` when product changes).
- `uploadingImages`, `uploadingVideos`: boolean.
- `uploadProgress`: 0–100 (for progress bar).
- `uploadError`: string | null.
- `certReportUrl`: string (controlled; synced from `product?.certReportUrl`; set only via certificate upload; no Report URL text input).
- `uploadingCertificate`: boolean.

### 6.3 Upload handler: `handleUploadMedia(type, files)`

**Algorithm:**

1. If no files, return.
2. Clear `uploadError`.
3. Set `maxCount` and `currentList`/`currentCount` from `type` (images 10, videos 5).
4. If `currentCount >= maxCount`: set error “Maximum X images/videos. You have Y.”; return (no upload).
5. `slotsLeft = maxCount - currentCount`. If `files.length > slotsLeft`: set error “Add up to Z more”; return.
6. Set `uploadProgress = 0`; set `uploadingImages` or `uploadingVideos` to true.
7. Build FormData: `type` + append all files under key `files`.
8. Create `XMLHttpRequest`; `open("POST", "/api/upload/product-media")`.
9. `xhr.upload.addEventListener("progress", ...)`: if `e.lengthComputable`, set `uploadProgress = round((e.loaded / e.total) * 100)`.
10. `xhr.addEventListener("load", ...)`: parse JSON; if status 2xx, append `data.urls` to the correct list and `.slice(0, MAX_PRODUCT_IMAGES)` or `.slice(0, MAX_PRODUCT_VIDEOS)`; else set `uploadError`. In finally (and on error/abort): set uploading flags false, `uploadProgress = 0`.
11. `xhr.addEventListener("error" | "abort", ...)`: clear uploading state and progress; on error set generic message.
12. `xhr.send(formData)`.

So: upload is only started if adding the new files would not exceed the limit; after success the list is capped again. Progress is derived from `loaded`/`total` of the single XHR upload.

### 6.4 Certificate upload: `handleUploadCertificate(files)`

**Algorithm:**

1. If no files, return. Take first file.
2. Clear `uploadError`; set `uploadingCertificate = true`.
3. FormData with key `file`; POST to `/api/upload/certificate` via XMLHttpRequest.
4. On load: if 2xx and `data.url`, set `certReportUrl(data.url)`; else set `uploadError`. Set `uploadingCertificate = false`.
5. On error/abort: set `uploadingCertificate = false`.

The certificate URL is submitted via a hidden input; the only way to set it is upload (no manual URL field).

### 6.5 Certificate viewer

**Component:** `CertificateViewer({ url, onRemove })` (inline in ProductForm). When `certReportUrl` is set, shows PDF via `<iframe src={url}>` or image via `<img src={url}>` (PDF detected by URL path ending in `.pdf`). "Remove" button clears the URL.

### 6.6 UI behaviour

- Upload buttons (labels + file inputs) are disabled when `uploadingImages`/`uploadingVideos` or when `imageUrlsList.length >= 10` / `videoUrlsList.length >= 5`.
- Textarea onChange for image URLs: split by newline/comma, trim, filter non-empty, then `.slice(0, MAX_PRODUCT_IMAGES)`. Same for video URLs with `.slice(0, MAX_PRODUCT_VIDEOS)`.
- Image previews: grid of thumbnails with remove (splice from list). Video previews: `<video controls>` per URL with remove.
- Progress bar and percentage shown while the corresponding upload is in progress.
- **Certificate:** Upload-only (no Report URL text input). "Upload certificate" button; after upload, `certReportUrl` is set and **CertificateViewer** shows PDF (iframe) or image (img) with a "Remove" button.

---

## 7. API routes (products)

- **GET /api/products** – List products (public or filtered); uses admin/cache layer; supports status, productType, categoryId, etc.
- **POST /api/products** – Create product: parse body (with `normalizeProductBody`), validate with `productCreateSchema`, then `createProductInDb` with `sellerId` from session; returns `{ success, productId }`.
- **GET /api/products/:id** – Single product (with seller info); uses cached `getProductById`.
- **PATCH /api/products/:id** – Update: auth and ownership check; parse body with `normalizeProductBody`, validate with `productUpdateSchema`, then `updateProductInDb`; returns `{ success, productId }`.
- **DELETE /api/products/:id** – Delete: auth and ownership check; `deleteProductInDb(id)`.

Create/update validation enforces max 10 images and 5 videos on the server regardless of client.

---

## 8. Storage RLS (Supabase)

**File:** `scripts/supabase-storage-policies.sql`.

Policies on `storage.objects`:

- **Service role full product-images:** `FOR ALL TO service_role USING (bucket_id = 'product-images') WITH CHECK (bucket_id = 'product-images')`.
- **Service role full product-videos:** same for `bucket_id = 'product-videos'`.
- **Service role full product-certificates:** same for `bucket_id = 'product-certificates'` (lab report / certificate uploads).

The app uploads only via the API using the service role key; no policy grants anon/authenticated INSERT on these buckets, so unauthenticated or client-side uploads are not allowed by RLS.

---

## 9. Summary

| Area | Logic / algorithm | Key functions / files |
|------|-------------------|------------------------|
| Schema | Product + product_image + product_video + product_jewellery_gemstone; enums for status, type, shape, etc. | `drizzle/schema/product-schema.ts` |
| Validation | Zod base schema + loose_stone refinements + media limits (10 images, 5 videos) | `features/products/schemas/products.ts` |
| Body normalize | Array → newline/string form for API | `normalizeProductBody` in `features/products/api/normalize-product-body.ts` |
| SKU | Category short code + 10-char random UUID prefix | `generateSku` in `features/products/db/products.ts` |
| Create | Insert product, then images, videos, gemstones | `createProductInDb` |
| Update | Update product; replace images/videos/gemstones when provided | `updateProductInDb` |
| Read one | Product + image URLs + video URLs + jewellery gemstones | `getProductById` |
| Upload (images/videos) | Auth → Supabase service client → validate type/size → upload per file → return public URLs | `POST /api/upload/product-media`, `lib/supabase/server.ts` |
| Upload (certificate) | Single file (PDF/image), max 10 MB → `product-certificates` bucket → return single URL for `certReportUrl` | `POST /api/upload/certificate`, `lib/supabase/server.ts` |
| Form limits | Block upload if at cap; cap pasted URLs; cap after append; progress via XHR; certificate: one file, set certReportUrl | `handleUploadMedia`, `handleUploadCertificate`, state, ProductForm.tsx |

This covers the technical behaviour of products and related usage (images, videos, certificate upload, limits, and upload flow) end to end.

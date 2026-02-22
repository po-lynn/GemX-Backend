# Mobile API Documentation

---

## 1. API routes overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/mobile/register` | No | Register (phone, password, name) |
| POST | `/api/mobile/login` | No | Login (phone, password) |
| GET | `/api/categories` | No | List categories. Query: `type` (optional) |
| GET | `/api/products` | No | List all products. Query: `page`, `limit`, `search`, `productType`, `categoryId`, `status`, `stoneCut`, `shape`, `origin`, `laboratoryId` |
| GET | `/api/products/:id` | No | Get single product by ID |
| GET | `/api/products/mine` | Yes | List current user’s products. Same query params as list all. |
| POST | `/api/products` | Yes | Create product (JSON body) |
| PATCH | `/api/products/:id` | Yes | Update product (owner or admin). JSON body. |
| DELETE | `/api/products/:id` | Yes | Delete product (owner or admin) |

List responses (`GET /api/products`, `GET /api/products/mine`) may be cached (e.g. 60s); filter and search query params are part of the cache key so each combination returns the correct result.

---

## 2. Base URL and headers

- **Base URL:** `https://gem-x-backend.vercel.app` (e.g. `http://localhost:3000` in dev)
- **Content-Type:** `application/json` for all request bodies.
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
  "name": "John Doe"
}
```

- **phone:** Myanmar phone, must start with `09`, 9–17 digits (e.g. `09123456789`).
- **password:** Required.
- **name:** Optional; defaults to `"Mobile User"`.

**Success (201):** Response body is the auth result (user + session). Store the **session token** from the response for the `Authorization: Bearer` header.

**Errors:**

- **400** – `{ "error": "Phone must start with 09 and password is required" }`
- **4xx/5xx** – Check `error` message in body.

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

| Param  | Type   | Description                                  |
|--------|--------|----------------------------------------------|
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

## 5. Products

### 5.1 List all products (public)

**GET** `/api/products`

**Auth:** Not required.

**Query:**

| Param        | Type   | Default | Description                                      |
|-------------|--------|---------|--------------------------------------------------|
| `page`      | number | 1       | Page number                                     |
| `limit`     | number | 20      | Items per page (max 100)                         |
| `search`    | string | -       | Search in title and seller                       |
| `productType` | string | -     | Filter by type: `loose_stone` or `jewellery`    |
| `categoryId`  | string | -     | Filter by category UUID (from GET /api/categories) |
| `status`    | string | -       | Filter by status: `active`, `archive`, `sold`, `hidden` |
| `stoneCut`  | string | -       | Filter by cut: `Faceted` or `Cabochon` (loose stones) |
| `shape`     | string | -       | Filter by shape: `Oval`, `Cushion`, `Round`, `Pear`, `Heart` |
| `origin`    | string | -       | Filter by origin name (e.g. from GET /api/origins or your origins list) |
| `laboratoryId` | string | -     | Filter by laboratory UUID (from GET /api/laboratories) |

**Success (200):** See response shape below.

---

#### Search and filter (products list)

The list endpoints support **search**, **filters**, and **pagination**. Use the same query params for **GET /api/products** (all products) and **GET /api/products/mine** (my products).

**Query parameters**

| Param        | Type   | Default | Description |
|-------------|--------|---------|-------------|
| `page`      | number | 1       | Page number (1-based). |
| `limit`     | number | 20      | Items per page (max 100). |
| `search`    | string | -       | Search term. Matches **product title**, **seller name**, **seller phone**, and **seller email** (case-insensitive partial match). |
| `productType` | string | -     | Filter by product type: `loose_stone` or `jewellery`. |
| `categoryId`  | string | -     | Filter by category (UUID from GET /api/categories). |
| `status`    | string | -       | Filter by status: `active`, `archive`, `sold`, `hidden`. |
| `stoneCut`  | string | -       | Filter by cut: `Faceted` or `Cabochon`. |
| `shape`     | string | -       | Filter by shape: `Oval`, `Cushion`, `Round`, `Pear`, `Heart`. |
| `origin`    | string | -       | Filter by origin name. |
| `laboratoryId` | string | -     | Filter by laboratory (UUID from GET /api/laboratories). |

**What is matched by `search`**

- Product **title** (e.g. `"sapphire"` finds "Blue Sapphire 2ct")
- Seller **name**
- Seller **phone**
- Seller **email**

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

**Success (200):**

```json
{
  "products": [
    {
      "id": "uuid",
      "sku": "PRD-XXX",
      "title": "Blue Sapphire 2ct",
      "description": "...",
      "identification": "Natural",
      "price": "2500",
      "currency": "USD",
      "productType": "loose_stone",
      "categoryId": "uuid",
      "categoryName": "Sapphire",
      "stoneCut": "Faceted",
      "metal": null,
      "status": "active",
      "moderationStatus": "approved",
      "isFeatured": false,
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

---

### 5.2 Get single product (public)

**GET** `/api/products/:id`

**Auth:** Not required.

**Success (200):** Single product with full detail (including `imageUrls[]`, `jewelleryGemstones[]` for jewellery, etc.).

**Errors:**

- **404** – `{ "error": "Product not found" }`

---

### 5.3 My products (current user’s list)

**GET** `/api/products/mine`

**Auth:** Required. `Authorization: Bearer <session_token>`.

**Query:** Same parameters as **List all products** (see 5.1 and “Search and filter” below): `page`, `limit`, `search`, `productType`, `categoryId`, `status`, `stoneCut`, `shape`, `origin`, `laboratoryId`. All are optional.

**Examples:**

- `GET /api/products/mine?page=1&limit=20`
- `GET /api/products/mine?status=active&stoneCut=Cabochon` (with Bearer token)

**Success (200):** Same shape as “List all products”: `{ "products": [...], "total": n }` but only the logged-in user’s products.

**Errors:**

- **401** – `{ "error": "Unauthorized" }` — missing or invalid token.

---

### 5.4 Create product

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
- `imageUrls` – array of strings (image URLs)
- `isNegotiable` (boolean)

**Loose stone:**

- `stoneCut` – `"Faceted"` | `"Cabochon"`
- `weightCarat`, `dimensions`, `color`, `shape`, `origin`
- `shape` – `"Oval"` | `"Cushion"` | `"Round"` | `"Pear"` | `"Heart"`
- `laboratoryId`, `certReportNumber`, `certReportDate`, `certReportUrl`

**Jewellery:**

- `metal` – `"Gold"` | `"Silver"` | `"Other"`
- `totalWeightGrams`
- `jewelleryGemstones` – array of gemstone objects (see **Jewellery with gemstones** below). Product-level `color` and `origin` are not used for jewellery; each stone has its own `color` and `origin` in this array.

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
  "status": "active",
  "imageUrls": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
}
```

**Jewellery with gemstones (seller create)**

For `productType: "jewellery"` you can send one or more stones in `jewelleryGemstones`. Each item describes one gemstone type in the piece (e.g. centre ruby + side diamonds).

Get valid category IDs from **GET /api/categories** (use `?type=jewellery` or `?type=loose_stone` depending on how your backend defines gem categories — e.g. Ruby, Sapphire, Diamond).

**Each `jewelleryGemstones` item:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `categoryId` | Yes | string (UUID) | Category of the gem (e.g. Ruby, Diamond). From `/api/categories`. |
| `weightCarat` | Yes | string | Total weight in carats for this stone type (e.g. `"1.5"`). |
| `pieceCount` | No | number or string | Number of stones of this type (e.g. 37 for “Ruby: 37 pcs”). |
| `dimensions` | No | string | e.g. `"5x3mm"`. |
| `color` | Yes | string | e.g. `"Red"`, `"White"`. Required for each jewellery gemstone. |
| `shape` | No | string | `"Oval"` \| `"Cushion"` \| `"Round"` \| `"Pear"` \| `"Heart"`. |
| `origin` | Yes | string | e.g. `"Myanmar"`. Required for each jewellery gemstone. |
| `cut` | No | string | Cut style (e.g. `"Brilliant"`, `"Step"`). |
| `transparency` | No | string | e.g. `"Transparent"`. |
| `comment` | No | string | Lab comment. |
| `inclusions` | No | string | e.g. `"Rutiles, feathers"`. |

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

### 5.5 Update product

**PATCH** `/api/products/:id`

**Auth:** Required. User can update **only their own** product (or admin can update any).

**Request body (JSON):** Same fields as create; all optional. Send only fields you want to change.

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

### 5.6 Delete product

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

## 6. Quick flow for React Native

1. **Auth**
   - Call `POST /api/mobile/register` or `POST /api/mobile/login`.
   - From the response, read and store the session token (exact key depends on better-auth response; often `session.token` or similar).
   - On every protected request, set header: `Authorization: Bearer <stored_token>`.

2. **Categories**
   - On app load or before “Add product”: `GET /api/categories` (optionally with `?type=loose_stone` or `?type=jewellery`).
   - Cache the list; use for dropdowns and for `categoryId` when creating/editing products.

3. **Browse**
   - List: `GET /api/products?page=1&limit=20` (optional: `search`, `productType`, `categoryId`, `status`, `stoneCut`, `shape`, `origin`, `laboratoryId`).
   - Detail: `GET /api/products/:id`.

4. **My products**
   - List: `GET /api/products/mine?page=1&limit=20` (same optional query params as browse; with Bearer token).

5. **Sell**
   - Create: `POST /api/products` with JSON body (with Bearer token).
   - Edit: `PATCH /api/products/:id` (with Bearer token).
   - Delete: `DELETE /api/products/:id` (with Bearer token).

---

## 7. Error format

- **Body:** `{ "error": "Human-readable message" }`.
- **Validation (400):** May also include `details`: `{ "fieldName": ["error message"] }`.
- **Status codes:** `400` bad input, `401` not logged in, `403` not allowed, `404` not found, `500` server error.

---

## 8. Summary table

| Method | Path                     | Auth   | Description           |
|--------|--------------------------|--------|-----------------------|
| POST   | `/api/mobile/register`   | No     | Register              |
| POST   | `/api/mobile/login`      | No     | Login                 |
| GET    | `/api/categories`        | No     | List categories (`?type` optional) |
| GET    | `/api/products`          | No     | List all products (see 5.1 for query params) |
| GET    | `/api/products/:id`      | No     | Get one product       |
| GET    | `/api/products/mine`     | Yes    | List my products (same query params as list all) |
| POST   | `/api/products`          | Yes    | Create product        |
| PATCH  | `/api/products/:id`      | Yes    | Update (owner/admin)  |
| DELETE | `/api/products/:id`      | Yes    | Delete (owner/admin)  |

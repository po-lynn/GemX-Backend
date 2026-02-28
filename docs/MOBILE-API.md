# Mobile API Documentation

---

## Recent changes

- **Register** – Request body now accepts optional fields: `nrc`, `address`, `city`, `state`, `country`, `gender`, `dateOfBirth`. Validation errors from the auth provider (e.g. password too short) are returned in the `error` field instead of a generic message.
- **GET /api/products** – Public list returns **active** products only by default; use query `status` to override. New query params: `isCollectorPiece=true` (high-value collector pieces only) and `isPrivilegeAssist=true` (products sold by us only). Product items include `isCollectorPiece` and `isPrivilegeAssist` (boolean).
- **GET /api/products/mine** – Same query params as list all, including `isCollectorPiece` and `isPrivilegeAssist`. Returns all statuses by default (seller sees full list).
- **GET /api/products/:id** – Response includes a `seller` object (id, name, phone, username, displayUsername) and product fields `isCollectorPiece`, `isPrivilegeAssist`.
- **GET /api/profile** – Returns current user profile and a list of **active** products only; optional query params (page, limit, search, filters) apply to that list.
- **GET /api/origins** – List origins for product create/edit (id, name, country).
- **GET /api/laboratories** – List laboratories for product create/edit (id, name, address, phone, precaution).
- **POST /api/products** and **PATCH /api/products/:id** – Request body accepts optional `isCollectorPiece` (boolean) and `isPrivilegeAssist` (boolean) for high-value / sold-by-us flags.

---

## 1. API routes overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/mobile/register` | No | Register (phone, password, name) |
| POST | `/api/mobile/login` | No | Login (phone, password) |
| GET | `/api/categories` | No | List categories. Query: `type` (optional) |
| GET | `/api/origins` | No | List origins (for product create/edit). |
| GET | `/api/laboratories` | No | List laboratories (for product create/edit). |
| GET | `/api/products` | No | List products (default **active** only). Query: `page`, `limit`, `search`, `productType`, `categoryId`, `status`, `stoneCut`, `shape`, `origin`, `laboratoryId`, `isCollectorPiece`, `isPrivilegeAssist` |
| GET | `/api/products/:id` | No | Get single product by ID |
| GET | `/api/products/mine` | Yes | List current user’s products. All statuses by default. Same query params as list all. |
| GET | `/api/profile` | Yes | Get current user profile and their products (optional query: page, limit, filters). |
| POST | `/api/products` | Yes | Create product (JSON body) |
| PATCH | `/api/products/:id` | Yes | Update product (owner or admin). JSON body. |
| DELETE | `/api/products/:id` | Yes | Delete product (owner or admin) |
| GET | `/api/news` | No | List news. Query: `page`, `limit`, `status` (optional) |
| GET | `/api/news/:id` | No | Get single news by ID (published only) |
| GET | `/api/articles` | No | List articles. Query: `page`, `limit`, `status` (optional) |
| GET | `/api/articles/:id` | No | Get single article by ID (published only) |

List responses (`GET /api/products`, `GET /api/products/mine`, `GET /api/news`, `GET /api/articles`) may be cached (e.g. 60s); filter and search query params are part of the cache key so each combination returns the correct result.

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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| **phone** | string | Yes | Myanmar phone, must start with `09`, 9–17 digits (e.g. `09123456789`). |
| **password** | string | Yes | User password. |
| **name** | string | No | Display name; defaults to `"Mobile User"`. |
| **nrc** | string | No | National Registration Card number. |
| **address** | string | No | Street address. |
| **city** | string | No | City. |
| **state** | string | No | State / region. |
| **country** | string | No | Country. |
| **gender** | string | No | Gender (e.g. `male`, `female`, `other`). |
| **dateOfBirth** | string | No | Date of birth (e.g. `YYYY-MM-DD`). |

**Success (201):** Response body is the auth result (user + session). Store the **session token** from the response for the `Authorization: Bearer` header.

**Errors:**

- **400** – `{ "error": "Phone must start with 09 and password is required" }` or other validation message (e.g. `"Password is too short"` from the auth provider).
- **409** – `{ "error": "This phone number is already registered" }` when the phone is already in use.
- **4xx/5xx** – Response body includes an `error` string with the actual message (e.g. auth validation errors).

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

| Field    | Type   | Description        |
|----------|--------|--------------------|
| `id`     | string | Origin UUID        |
| `name`   | string | Origin name        |
| `country`| string | Country            |

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

| Field       | Type   | Description        |
|------------|--------|--------------------|
| `id`       | string | Laboratory UUID    |
| `name`     | string | Laboratory name    |
| `address`  | string | Address            |
| `phone`    | string | Phone              |
| `precaution` | string \| null | Optional precaution note |

**Use in app:** Call when building the product form (create/edit). Use `id` for the product `laboratoryId` field (certification) or for filter dropdowns.

---

## 5. Products

### 5.1 List all products (public)

**GET** `/api/products`

**Auth:** Not required.

**Behaviour:** The public list returns **active** products only by default. Use the `status` query param to request other statuses (e.g. `archive`, `sold`, `hidden`) if needed. Use `isCollectorPiece=true` to list only collector pieces (high-value items); use `isPrivilegeAssist=true` to list only Privilege Assist products (sold by us).

**Query:**

| Param        | Type   | Default | Description                                      |
|-------------|--------|---------|--------------------------------------------------|
| `page`      | number | 1       | Page number                                     |
| `limit`     | number | 20      | Items per page (max 100)                         |
| `search`    | string | -       | Search in title and seller                       |
| `productType` | string | -     | Filter by type: `loose_stone` or `jewellery`    |
| `categoryId`  | string | -     | Filter by category UUID (from GET /api/categories) |
| `status`    | string | `active` | Filter by status: `active`, `archive`, `sold`, `hidden`. Public list defaults to active. |
| `stoneCut`  | string | -       | Filter by cut: `Faceted` or `Cabochon` (loose stones) |
| `shape`     | string | -       | Filter by shape: `Oval`, `Cushion`, `Round`, `Pear`, `Heart` |
| `origin`    | string | -       | Filter by origin name (e.g. from GET /api/origins or your origins list) |
| `laboratoryId` | string | -     | Filter by laboratory UUID (from GET /api/laboratories) |
| `isCollectorPiece` | boolean | -   | When `true`, return only collector pieces (high-value items). |
| `isPrivilegeAssist` | boolean | -   | When `true`, return only Privilege Assist products (sold by us). |

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
| `status`    | string | -       | Filter by status: `active`, `archive`, `sold`, `hidden`. Public list defaults to `active`. |
| `stoneCut`  | string | -       | Filter by cut: `Faceted` or `Cabochon`. |
| `shape`     | string | -       | Filter by shape: `Oval`, `Cushion`, `Round`, `Pear`, `Heart`. |
| `origin`    | string | -       | Filter by origin name. |
| `laboratoryId` | string | -     | Filter by laboratory (UUID from GET /api/laboratories). |
| `isCollectorPiece` | boolean | -   | When `true`, only collector pieces. |
| `isPrivilegeAssist` | boolean | -   | When `true`, only Privilege Assist (sold by us). |

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

**7. Collector pieces only (high-value items)**

```
GET /api/products?isCollectorPiece=true
GET /api/products/mine?isCollectorPiece=true
Authorization: Bearer <session_token>
```

**8. Privilege Assist only (products sold by us)**

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
      "isCollectorPiece": false,
      "isPrivilegeAssist": false,
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

Each product item includes `isCollectorPiece` (boolean) and `isPrivilegeAssist` (boolean).

---

### 5.2 Get single product (public)

**GET** `/api/products/:id`

**Auth:** Not required.

**Success (200):** Single product with full detail (including `imageUrls[]`, `jewelleryGemstones[]` for jewellery, `isCollectorPiece`, `isPrivilegeAssist`, etc.). The response includes a **`seller`** object (or `null` if seller not found) with:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Seller user ID |
| `name` | string | Seller display name |
| `phone` | string \| null | Seller phone (for contact) |
| `username` | string \| null | Seller username |
| `displayUsername` | string \| null | Seller display username |

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
- `imageUrls` – array of strings (image URLs)
- `isNegotiable` (boolean)
- `isFeatured` (boolean) – mark as featured
- `isCollectorPiece` (boolean) – high-value collector piece (e.g. 1M+)
- `isPrivilegeAssist` (boolean) – product sold by us

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

### 5.6 Update product

**PATCH** `/api/products/:id`

**Auth:** Required. User can update **only their own** product (or admin can update any).

**Request body (JSON):** Same fields as create; all optional. Send only fields you want to change. Includes optional `isCollectorPiece` and `isPrivilegeAssist` (boolean).

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

| Param   | Type   | Default      | Description                                              |
|--------|--------|--------------|----------------------------------------------------------|
| `page` | number | 1            | Page number (1-based).                                  |
| `limit`| number | 20           | Items per page (max 100).                                |
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

| Param   | Type   | Default      | Description                                              |
|--------|--------|--------------|----------------------------------------------------------|
| `page` | number | 1            | Page number (1-based).                                  |
| `limit`| number | 20           | Items per page (max 100).                                |
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

2. **Categories**
   - On app load or before “Add product”: `GET /api/categories` (optionally with `?type=loose_stone` or `?type=jewellery`).
   - Cache the list; use for dropdowns and for `categoryId` when creating/editing products.

3. **Browse**
   - List: `GET /api/products?page=1&limit=20` (optional: `search`, `productType`, `categoryId`, `status`, `stoneCut`, `shape`, `origin`, `laboratoryId`, `isCollectorPiece`, `isPrivilegeAssist`). Public list defaults to active only.
   - Detail: `GET /api/products/:id`.

4. **My products**
   - List: `GET /api/products/mine?page=1&limit=20` (same optional query params as browse, including `isCollectorPiece`, `isPrivilegeAssist`; with Bearer token). Returns all statuses by default.

5. **Profile**
   - Get profile and own products: `GET /api/profile` (optional: `?page=1&limit=20` and same filter params; with Bearer token).

6. **Sell**
   - Create: `POST /api/products` with JSON body (with Bearer token).
   - Edit: `PATCH /api/products/:id` (with Bearer token).
   - Delete: `DELETE /api/products/:id` (with Bearer token).

6. **News**
   - List: `GET /api/news?page=1&limit=20` (optional: `?status=published` or `?status=draft`).
   - Detail: `GET /api/news/:id` (returns 404 for drafts).

7. **Articles**
   - List: `GET /api/articles?page=1&limit=20` (optional: `?status=published` or `?status=draft`).
   - Detail: `GET /api/articles/:id` (returns 404 for drafts).

---

## 9. Error format

- **Body:** `{ "error": "Human-readable message" }`.
- **Validation (400):** May also include `details`: `{ "fieldName": ["error message"] }`.
- **Status codes:** `400` bad input, `401` not logged in, `403` not allowed, `404` not found, `500` server error.

---

## 10. Summary table

| Method | Path                     | Auth   | Description           |
|--------|--------------------------|--------|-----------------------|
| POST   | `/api/mobile/register`   | No     | Register              |
| POST   | `/api/mobile/login`      | No     | Login                 |
| GET    | `/api/categories`        | No     | List categories (`?type` optional) |
| GET    | `/api/origins`           | No     | List origins (for product create/edit) |
| GET    | `/api/laboratories`      | No     | List laboratories (for product create/edit) |
| GET    | `/api/products`          | No     | List products (default active only; see 5.1 for query params including isCollectorPiece, isPrivilegeAssist) |
| GET    | `/api/products/:id`      | No     | Get one product       |
| GET    | `/api/products/mine`     | Yes    | List my products (all statuses by default; same query params as list all) |
| GET    | `/api/profile`           | Yes    | Get profile and own products (optional query params) |
| POST   | `/api/products`          | Yes    | Create product        |
| PATCH  | `/api/products/:id`      | Yes    | Update (owner/admin)  |
| DELETE | `/api/products/:id`      | Yes    | Delete (owner/admin)  |
| GET    | `/api/news`              | No     | List news (`?page`, `?limit`, `?status`) |
| GET    | `/api/news/:id`          | No     | Get one news (published only) |
| GET    | `/api/articles`          | No     | List articles (`?page`, `?limit`, `?status`) |
| GET    | `/api/articles/:id`      | No     | Get one article (published only) |

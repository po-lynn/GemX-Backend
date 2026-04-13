# Technical Documentation: Escrow Service Requests

**Convention:** When you add or change logic, algorithms, or function-level behaviour in this domain, update this file. See [docs/README.md](./README.md).

---

## Overview

The escrow service request feature lets authenticated mobile users (buyers or sellers) ask GemX admin to act as an intermediary for a high-value deal. Admin staff review the request, contacts both parties, and facilitates the transaction.

---

## 1. Database schema

### Table: `escrow_service_request`

Defined in `drizzle/schema/escrow-service-request-schema.ts`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default random | Row identifier. |
| `user_id` | text | not null, FK → `user.id` cascade delete | The authenticated user who submitted the request (requester). |
| `type` | text | not null | `"buyer"` — requester wants to verify a product before purchase; `"seller"` — requester wants a committed buyer. |
| `product_id` | uuid | nullable, FK → `product.id` set null on delete | Optional reference to a catalog product. Nullable so requests survive product deletion. |
| `seller_id` | text | nullable, FK → `user.id` set null on delete | Auto-resolved from `product.sellerId` when `productId` is submitted. Nulled when the seller user is deleted. |
| `package_name` | text | nullable | Reserved for future premium dealer package reference. Always `null` currently. |
| `message` | text | nullable | Optional note from requester to admin (max 2000 chars). |
| `status` | text | not null, default `"pending"` | Admin workflow state (see §3). |
| `admin_note` | text | nullable | Internal admin note. **Never returned to mobile clients.** |
| `created_at` | timestamp | not null, default now | Creation time. |
| `updated_at` | timestamp | not null, default now, auto-updated | Last update time. |

**Indexes:**
- `escrow_service_request_user_id_idx` — on `user_id` (for per-user list query)
- `escrow_service_request_status_idx` — on `status` (for admin filter query)
- `escrow_service_request_created_at_idx` — on `created_at` (for ordered pagination)

**Cascade behaviour:**
- If the requester user is deleted → the row is deleted (`cascade`).
- If the product or seller user is deleted → `product_id` / `seller_id` are set to `null` (row is preserved for admin history).

---

## 2. Validation schemas

Defined in `features/escrow-service-requests/schemas/escrow-service-requests.ts`.

### `mobileSubmitEscrowSchema` (POST body)

| Field | Zod rule | Required | Notes |
|-------|----------|----------|-------|
| `type` | `z.enum(["buyer", "seller"])` | Yes | Strict enum — no other value accepted. |
| `productId` | `z.string().uuid().optional()` | No | Must be a valid UUID v4 format if provided. |
| `message` | `z.string().trim().max(2000).optional()` | No | Trimmed before storage; empty string treated as absent. |

### `mobileEscrowListQuerySchema` (GET query params)

| Field | Zod rule | Default |
|-------|----------|---------|
| `page` | `z.coerce.number().int().min(1)` | `1` |
| `limit` | `z.coerce.number().int().min(1).max(50)` | `10` |

### `adminUpdateEscrowStatusSchema` (admin server action)

| Field | Zod rule | Required |
|-------|----------|----------|
| `status` | `z.enum(["pending", "contacted", "deal_made", "rejected"])` | Yes |
| `adminNote` | `z.string().trim().max(5000).optional()` | No |

---

## 3. Status workflow

```
pending → contacted → deal_made
                   ↘ rejected
pending →             rejected
```

| Status | Meaning |
|--------|---------|
| `pending` | Newly submitted; awaiting admin attention. |
| `contacted` | Admin has reached out to requester and/or seller. |
| `deal_made` | Deal successfully facilitated. |
| `rejected` | Request rejected by admin (duplicate, spam, no response, etc.). |

Admin can transition to any state at any time (no enforced state machine). The `adminNote` field captures the reason for the transition.

---

## 4. Business rules & security

### 4.1 Self-escrow prevention

**File:** `app/api/mobile/escrow-service-requests/route.ts`

When `type === "buyer"` and `productId` is provided, the route fetches the product's `sellerId`. If `sellerId === session.user.id`, the request is rejected with **400 "Cannot request escrow for your own product"**. A seller cannot pose as a buyer for their own listing.

```
if (type === "buyer" && sellerId === session.user.id) → 400
```

### 4.2 Product validation

If `productId` is provided, the route queries the `product` table with a `limit(1)`. If no row is returned, the request is rejected with **404 "Product not found"**. This prevents orphan references and ensures the seller link is always valid.

### 4.3 Seller auto-resolution

The `sellerId` is **never sent by the client** — it is always resolved server-side from `product.sellerId`. This ensures the seller identity is authoritative and cannot be spoofed.

### 4.4 Admin-note confidentiality

`adminNote` is set and managed only via the admin server action. It is excluded from all mobile GET responses. Only admin-authenticated server actions can write to this field.

### 4.5 Admin action authorization

**File:** `features/escrow-service-requests/actions/escrow-service-requests.ts`

The `updateEscrowServiceRequestStatusAction` server action:
1. Verifies the session exists and `canAdminManageUsers(session.user.role)` returns `true`.
2. Validates `requestId` as a UUID via `z.string().uuid()` before any DB access (prevents malformed IDs reaching the query layer).
3. Validates `status` and `adminNote` through `adminUpdateEscrowStatusSchema`.

---

## 5. API layer

### 5.1 POST handler algorithm

**File:** `app/api/mobile/escrow-service-requests/route.ts`

```
1. Authenticate session → 401 if missing
2. Parse + validate body via mobileSubmitEscrowSchema → 400 if invalid
3. If productId provided:
   a. SELECT sellerId FROM product WHERE id = productId LIMIT 1
   b. → 404 if not found
   c. If type == "buyer" AND sellerId == session.user.id → 400 (self-escrow)
4. INSERT into escrow_service_request
   - userId = session.user.id
   - type, productId (or null), sellerId (or null), message (or null)
   - packageName = null (reserved for future use)
   - status = "pending"
5. Return { success, requestId, createdAt }
```

**DB operations:** 1 optional `SELECT` + 1 `INSERT` = at most 2 round-trips.

### 5.2 GET handler algorithm

**File:** `app/api/mobile/escrow-service-requests/route.ts`

```
1. Authenticate session → 401 if missing
2. Parse page/limit from URL searchParams via mobileEscrowListQuerySchema
3. Promise.all:
   a. SELECT rows (with LEFT JOIN product for title) WHERE userId = session.user.id
      ORDER BY createdAt DESC, LIMIT/OFFSET for pagination
   b. SELECT count(*) WHERE userId = session.user.id
4. Map rows: attach product: { title } or null
5. Return { requests, page, limit, total }
```

**Security:** `adminNote` is never selected. Query is scoped to `session.user.id` so users only see their own requests.

**DB operations:** 2 parallel queries (rows + count) per request.

---

## 6. DB query layer

**File:** `features/escrow-service-requests/db/escrow-service-requests.ts`

### `getEscrowServiceRequestsPaginated`

Used by the admin panel page. Joins three tables:
- `INNER JOIN user` (aliased as `user`) → requester name/email/phone
- `LEFT JOIN user` (aliased as `seller_user`) → seller name/email/phone (null if no product/seller)
- `LEFT JOIN product` → product title (null if product deleted)

Supports `status` and `type` filters composed via `and()`. Paginated with `limit`/`offset` from `(page - 1) * limit`. Ordered by `createdAt DESC` (newest first).

**Why two user joins:** Drizzle requires an aliased table (`alias(user, "seller_user")`) to join the same table twice. Without aliasing, the query would have a column name collision.

### `updateEscrowServiceRequestStatusInDb`

Updates `status` and optionally `adminNote`, sets `updatedAt = new Date()`. Returns `{ ok: true, requestId }` on success, `{ ok: false, error: "not_found" }` if the row doesn't exist (uses `.returning()` to detect this without a separate SELECT).

---

## 7. Admin UI

**File:** `features/escrow-service-requests/components/EscrowServiceRequestsTable.tsx`

- **Requester** column: name linked to `/admin/users/[userId]/edit`
- **Seller** column: name linked to `/admin/users/[sellerId]/edit` (only when `sellerId` is not null)
- **Product** column: title linked to `/admin/products/[productId]/edit` (only when `productId` is not null)
- **Inline edit**: clicking "Update" opens a status select + admin note textarea in-row. Submits via `updateEscrowServiceRequestStatusAction` server action; on success triggers `router.refresh()` to revalidate the page data.
- **Filters**: admin page supports `status` and `type` filter query params. Each filter combo is a separate URL so browser back/forward work correctly. Pagination uses the same query params.

---

## 8. Test coverage

**File:** `tests/api/mobile/escrow-service-requests.test.ts`

| Test | Layer |
|------|-------|
| POST: 401 unauthenticated | Auth guard |
| POST: 400 missing type | Schema validation |
| POST: 400 invalid type value | Schema validation |
| POST: 400 malformed UUID for productId | Schema validation |
| POST: 400 self-escrow (buyer for own product) | Business rule §4.1 |
| POST: 404 product not found | Product validation §4.2 |
| POST: 200 success without productId | Happy path |
| POST: 200 success with productId — sellerId stored | Happy path + §4.3 |
| POST: 500 DB insert throws | Error handling |
| POST: 500 DB insert returns empty | Error handling |
| GET: 401 unauthenticated | Auth guard |
| GET: 200 paginated results with product title | Happy path |
| GET: 200 empty list | Happy path |
| GET: 200 page/limit params respected | Pagination |
| GET: 200 product null when no title | Null handling |
| GET: 500 DB throws | Error handling |

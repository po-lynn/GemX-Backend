# QA — Points & Purchase Requests

> **Feature:** Credit point system — packages, purchase requests, admin approve/reject  
> **Scope:** `GET /api/mobile/point-packages`, `POST /api/mobile/points/purchase-request`, `GET /api/mobile/points/purchase-requests`, `/api/admin/point-purchase-requests/*`

---

## 1. GET /api/mobile/point-packages

**Auth:** None required

| TC# | Test Case | Auth | Expected Status | Expected Response | Priority |
|-----|-----------|------|-----------------|-------------------|----------|
| PKG-01 | No packages configured | None | 200 | `{ pointPackages: [], paymentMethods: [] }` | High |
| PKG-02 | Packages configured | None | 200 | `{ pointPackages: [{name, points, priceMmk, ...}], paymentMethods: [{name, accountName, phoneNumber, ...}] }` | Critical |
| PKG-03 | Package with only MMK price | None | 200 | `priceUsd` and `priceKrw` absent or null on that package | Medium |
| PKG-04 | Response is cached | Call twice | None | Second call served from cache — check `Cache-Control` response header | Low |
| PKG-05 | `points` is always integer ≥ 1 | None | 200 | All `pointPackages[].points` values are integers ≥ 1 | Medium |
| PKG-06 | Optional price fields are integers when present | None | 200 | `priceMmk`, `priceUsd`, `priceKrw` are integers ≥ 0 when present | Medium |

---

## 2. POST /api/mobile/points/purchase-request

**Headers:** `Authorization: Bearer {token}`, `Content-Type: application/json`

| TC# | Test Case | Request Body | Expected Status | Expected Response | Priority |
|-----|-----------|--------------|-----------------|-------------------|----------|
| PPR-01 | Valid MMK request | `{"packageName":"Starter","currency":"mmk","transferredAmount":5000,"transferredName":"Ko Aung","transactionReference":"TXN-001"}` | 201 | `{success:true, requestId, packageName, points, price:5000, currency:"mmk", status:"pending"}` | Critical |
| PPR-02 | Valid USD request (package has USD price) | `{...,"currency":"usd","transferredAmount":10}` | 201 | `price` = package's `priceUsd` value | High |
| PPR-03 | Currency not configured on package | Package has no USD price, send `"currency":"usd"` | 400 | `"Package does not have a price set for USD"` | High |
| PPR-04 | Package not found | `{"packageName":"Nonexistent",...}` | 400 | `"Package not found"` | High |
| PPR-05 | Missing `transferredName` | Omit field | 400 | `"Invalid input"` | High |
| PPR-06 | Missing `transactionReference` | Omit field | 400 | `"Invalid input"` | High |
| PPR-07 | Missing `transferredAmount` | Omit field | 400 | `"Invalid input"` | High |
| PPR-08 | Invalid currency value | `"currency":"eur"` | 400 | `"Invalid input"` — not in enum `["mmk","usd","krw"]` | High |
| PPR-09 | `transferredName` exceeds max length | 201-character string | 400 | Validation error (max 200 chars) | Medium |
| PPR-10 | `transactionReference` exceeds max length | 201-character string | 400 | Validation error (max 200 chars) | Medium |
| PPR-11 | `transferNote` is optional | Omit `transferNote` field | 201 | Success — `transferNote` is null in DB row | Medium |
| PPR-12 | `transferNote` too long | 501-character string | 400 | Validation error (max 500 chars) | Low |
| PPR-13 | No auth token | Any valid body | 401 | `{ error: "Unauthorized" }` | Critical |
| PPR-14 | Non-JSON body | Body: `"hello"` | 400 | Invalid input | Medium |
| PPR-15 | Price snapshot on submit | Submit request, admin changes package price, check DB row | — | `price` in DB matches price at time of request, not the new price | High |
| PPR-16 | Points snapshot on submit | Submit request, admin changes package points, check DB row | — | `points` in DB matches points at time of request | High |

**Step-by-step for PPR-01:**
1. Login via `POST /api/mobile/login` → save `token`
2. Confirm "Starter" package exists with `priceMmk: 5000` at `/admin/credit/point-packages`
3. `POST /api/mobile/points/purchase-request` with Bearer token and body above
4. Assert response: `status === "pending"`, `requestId` is a UUID string
5. Check DB row in `point_purchase_request`: `status=pending`, `transferred_name="Ko Aung"`, `transaction_reference="TXN-001"`, `transferred_amount=5000`

---

## 3. GET /api/mobile/points/purchase-requests

**Headers:** `Authorization: Bearer {token}`

| TC# | Test Case | Auth | Expected Status | Expected Response | Priority |
|-----|-----------|------|-----------------|-------------------|----------|
| HIST-01 | Returns own requests only | Bearer | 200 | `{ requests: [...] }` — only current user's rows | Critical |
| HIST-02 | Does not return other users' requests | User A and User B both have requests | 200 | Each user sees only their own | Critical |
| HIST-03 | Returns transfer fields | Auth | 200 | Each row includes `transferredAmount`, `transferredName`, `transactionReference` | High |
| HIST-04 | Ordered newest first | Multiple requests | 200 | `requests[0].createdAt` is the most recent | Medium |
| HIST-05 | No auth | None | 401 | Unauthorized | High |

---

## 4. GET /api/admin/point-purchase-requests

**Headers:** Admin session cookie

| TC# | Query Params | Expected Status | Expected Response | Priority |
|-----|--------------|-----------------|-------------------|----------|
| ADMIN-01 | `?status=pending` | 200 | Only rows with `status=pending`; includes `transferredName`, `transactionReference` | Critical |
| ADMIN-02 | `?status=approved` | 200 | Only approved rows | High |
| ADMIN-03 | `?status=rejected` | 200 | Only rejected rows | High |
| ADMIN-04 | `?status=all` | 200 | All rows regardless of status | High |
| ADMIN-05 | No status param | 200 | Defaults to `pending` | High |
| ADMIN-06 | `?page=2&limit=5` | 200 | Max 5 results, offset by 5 | Medium |
| ADMIN-07 | `?limit=200` | 400 | Validation error — limit max is 100 | Medium |
| ADMIN-08 | `?page=0` | 400 | Validation error — page min is 1 | Medium |
| ADMIN-09 | No auth | 401 | Unauthorized | Critical |
| ADMIN-10 | User-role session | 403 | Forbidden | Critical |
| ADMIN-11 | Response includes user info | Auth | 200 | Each row has `userName`, `userEmail` from joined user table | High |

---

## 5. POST /api/admin/point-purchase-requests/[id]/approve

**Headers:** Admin session cookie, `Content-Type: application/json`

| TC# | Test Case | Body | Expected Status | Expected Response | Priority |
|-----|-----------|------|-----------------|-------------------|----------|
| APR-01 | Approve valid pending request | `{}` | 200 | `{success:true, requestId, pointsAdded, userBalance}` | Critical |
| APR-02 | Approve with admin note | `{"adminNote":"Transfer verified at 10am"}` | 200 | Success; note saved in DB | High |
| APR-03 | User balance increases by `points` | Note balance before, approve 100-pt request | 200 | `userBalance` = previous + 100 | Critical |
| APR-04 | Double approve blocked | Approve, then approve same ID again | 400 | `"Request is not pending"` | Critical |
| APR-05 | Non-existent request ID | Random UUID | 404 | `"Request not found"` | High |
| APR-06 | Approve already-rejected request | Reject then approve | 400 | `"Request is not pending"` | High |
| APR-07 | `adminNote` over 500 chars | 501-char note | 400 | Validation error | Medium |
| APR-08 | No auth | — | 401 | Unauthorized | Critical |
| APR-09 | User-role session | User cookie | 403 | Forbidden | Critical |

**Step-by-step for APR-01:**
1. Note the user's current `points` balance (via DB or user profile endpoint)
2. Submit a purchase request via `POST /api/mobile/points/purchase-request` — note `requestId`
3. Call `POST /api/admin/point-purchase-requests/{requestId}/approve` with admin session
4. Assert response: `pointsAdded` equals the package's `points` value
5. Assert `userBalance` = previous balance + `pointsAdded`
6. Call `GET /api/admin/point-purchase-requests?status=approved` — confirm row appears
7. Call approve again on the same ID — expect 400 `"Request is not pending"`

---

## 6. POST /api/admin/point-purchase-requests/[id]/reject

**Headers:** Admin session cookie, `Content-Type: application/json`

| TC# | Test Case | Body | Expected Status | Expected Response | Priority |
|-----|-----------|------|-----------------|-------------------|----------|
| REJ-01 | Reject pending request | `{"adminNote":"Could not verify transfer"}` | 200 | `{success:true, requestId}` | Critical |
| REJ-02 | Reject without note | `{}` | 200 | Success — `adminNote` null in DB | High |
| REJ-03 | No points credited on rejection | Check user balance before and after rejection | — | Balance unchanged | Critical |
| REJ-04 | Double reject blocked | Reject, then reject same ID again | 400 | `"Request is not pending"` | High |
| REJ-05 | Non-existent request ID | Random UUID | 404 | `"Request not found"` | High |
| REJ-06 | Reject already-approved request | Approve then reject | 400 | `"Request is not pending"` | High |
| REJ-07 | No auth | — | 401 | Unauthorized | Critical |

---

## E2E Flows

### E2E-01: Full Point Purchase Flow

**Priority:** Critical

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin configures "Starter Pack" (100 pts, 5000 MMK) at `/admin/credit/point-packages` | Package saved to DB |
| 2 | Admin adds "KBZ Pay" payment method at `/admin/credit` | Payment method saved |
| 3 | Mobile: `GET /api/mobile/point-packages` | Returns package + KBZ Pay method |
| 4 | Customer transfers 5000 MMK to KBZ Pay | Done outside app |
| 5 | Mobile: `POST /api/mobile/points/purchase-request` with `transferredAmount:5000`, `transferredName`, `transactionReference` | 201 — row created with `status:pending` |
| 6 | Admin views `/admin/credit/purchase-requests` | Pending row shows all transfer details |
| 7 | Admin clicks Approve | `status → approved`, user balance increases by 100 pts |
| 8 | Mobile: `GET /api/mobile/points/purchase-requests` | Row shows `status:approved` |

---

### E2E-02: Rejected Request — No Points Credited

**Priority:** Critical

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Note user's current `points` balance | Baseline recorded |
| 2 | Submit purchase request | Pending row created |
| 3 | Admin clicks Reject with reason "Transfer not received" | `status → rejected` |
| 4 | Check user balance | Unchanged from baseline |

---

### E2E-03: Registration Bonus

**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin sets Default Points = 200, enables Registration Bonus | Settings saved |
| 2 | Register a new user via `POST /api/mobile/register` | 201 response |
| 3 | Check `user.points` in DB for the new user | Equals 200 |

---

### E2E-04: Double Approve Prevention

**Priority:** Critical

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit purchase request (100 pts) | Pending row |
| 2 | Admin approves — balance goes from 0 → 100 | Success |
| 3 | Admin tries to approve same request again | 400 `"Request is not pending"` |
| 4 | Check balance | Still 100 — no double credit |

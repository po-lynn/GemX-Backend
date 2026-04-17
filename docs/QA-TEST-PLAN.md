# GemX — QA Test Plan

> **Project:** GemX Gemstone & Jewellery Marketplace  
> **Scope:** Credit Point System, Point Purchase Flow, Premium Dealer, Featured Products, Auth, Admin UI  
> **Date:** 2026-04-17

---

## Table of Contents

1. [Admin UI](#section-1--admin-ui)
2. [Authentication](#section-2--authentication)
3. [Authorization & Roles](#section-3--authorization--roles)
4. [Point Purchase Packages API](#section-4--point-purchase-packages-api)
5. [Point Purchase Request API](#section-5--point-purchase-request-api)
6. [Admin Purchase Request Review API](#section-6--admin-purchase-request-review-api)
7. [Premium Dealer API](#section-7--premium-dealer-api)
8. [Feature Product API](#section-8--feature-product-api)
9. [Session & Error Handling](#section-9--session--error-handling)
10. [Integration Flows (End-to-End)](#section-10--integration-flows-end-to-end)
11. [Priority Legend](#priority-legend)

---

## SECTION 1 — ADMIN UI

### 1.1 Navigation & Sidebar

| TC# | Test Case | Steps | Expected Result | Priority |
|-----|-----------|-------|-----------------|----------|
| UI-01 | All sidebar links navigate correctly | Click each sidebar item | URL changes to correct page, active item highlights with left border accent | High |
| UI-02 | Settings group shows all items | Look at Settings group in sidebar | Shows: Point Management, Feature Settings, Premium Dealers Settings, Point Packages, Purchase Requests | High |
| UI-03 | Active state is exact for `/admin/credit` | Navigate to `/admin/credit` | Only "Point Management" is highlighted, not sub-items | High |
| UI-04 | Active state persists on sub-pages with query params | Navigate to `/admin/credit/purchase-requests?status=approved` | "Purchase Requests" stays highlighted | Medium |
| UI-05 | Mobile hamburger menu opens sidebar | Resize to < 768px, click hamburger icon | Sheet slides in with full navigation | Medium |

---

### 1.2 Point Management Form (`/admin/credit`)

| TC# | Test Case | Steps | Expected Result | Priority |
|-----|-----------|-------|-----------------|----------|
| UI-06 | Form loads with saved values | Navigate to page | All fields pre-filled with current DB values | High |
| UI-07 | Save with valid data | Fill all fields, click Save Point Settings | No error shown, page refreshes with saved values | High |
| UI-08 | Reset button reloads page | Change fields without saving, click Reset | All fields revert to last saved state | Medium |
| UI-09 | Add payment method | Click "Add payment method" | New card appears with empty name, accountName, phoneNumber, instructions fields | High |
| UI-10 | Remove payment method | Click trash icon on a method card | Card disappears immediately from UI | High |
| UI-11 | Payment methods persist after save | Add "KBZ Pay" method, save, reload page | KBZ Pay method card still shown with saved values | High |
| UI-12 | Registration bonus checkbox toggle | Uncheck "Enable Registration Bonus", save | `registrationBonusEnabled = false` stored in DB | Medium |
| UI-13 | Currency conversion inputs reject decimals | Enter 1.5 in MMK amount field | Browser rejects non-integer (input type=number step=1) | Low |

---

### 1.3 Point Packages Form (`/admin/credit/point-packages`)

| TC# | Test Case | Steps | Expected Result | Priority |
|-----|-----------|-------|-----------------|----------|
| UI-14 | Page shows title and description | Navigate to page | "Point Packages" heading, description text, Save button visible | High |
| UI-15 | Add package creates default row | Click "Add Package" | New row with name "New Package", 100 points, empty price fields | High |
| UI-16 | Optional price fields accept blank | Leave Price USD and Price KRW blank, save | Package saves without `priceUsd` / `priceKrw` fields | High |
| UI-17 | Optional price fields accept zero | Enter 0 in Price MMK, save | Saves as `priceMmk: 0` (valid value) | Medium |
| UI-18 | Remove package | Click trash icon on a package row | Package removed from list instantly | High |
| UI-19 | Empty state message | Remove all packages | "No packages yet. Add one below." placeholder shown | Low |
| UI-20 | Save button at top and bottom | Load page | Two Save buttons present (top-right and bottom-center) | Low |

---

### 1.4 Purchase Requests Page (`/admin/credit/purchase-requests`)

| TC# | Test Case | Steps | Expected Result | Priority |
|-----|-----------|-------|-----------------|----------|
| UI-21 | Default tab is Pending | Navigate to page with no query params | URL contains `status=pending`, pending requests shown | High |
| UI-22 | Status filter tabs update table | Click "Approved" tab | URL updates to `?status=approved`, table reloads with approved rows | High |
| UI-23 | All table columns present | Check table headers | User, Package, Points, Price, Transferred, Name, Reference, Note, Status, Date, Actions | High |
| UI-24 | Price column shows amount and currency | Have a MMK request in table | Cell shows e.g. `5,000 MMK` | High |
| UI-25 | Approve button credits points | Click Approve on a pending row | Row status badge → "approved", Actions cell → "—" | Critical |
| UI-26 | Reject with reason | Click Reject, enter reason in browser prompt | Row status badge → "rejected", reason shown below status badge | High |
| UI-27 | Reject without reason | Click Reject, leave prompt blank, click OK | Row status badge → "rejected", no note shown | Medium |
| UI-28 | Pagination appears with >20 requests | Create 21+ pending requests | Next / Previous buttons appear below table | Medium |
| UI-29 | Previous button disabled on page 1 | Be on page 1 | Previous button is rendered as disabled | Low |
| UI-30 | Total count displayed | Have 5 requests | "5 requests total" shown in card description | Low |

---

## SECTION 2 — AUTHENTICATION

### 2.1 Mobile Login — `POST /api/mobile/login`

| TC# | Test Case | Request Body | Expected Status | Expected Response | Priority |
|-----|-----------|--------------|-----------------|-------------------|----------|
| AUTH-01 | Valid phone and password | `{"phone":"09123456789","password":"pass123"}` | 200 | `{ user: {...}, session: {...}, token: "..." }` | Critical |
| AUTH-02 | Phone too short (< 9 digits after 09) | `{"phone":"091234","password":"pass123"}` | 400 | `{ error: "Phone must start with 09 and password is required" }` | High |
| AUTH-03 | Wrong password | `{"phone":"09123456789","password":"wrongpass"}` | 401 | `{ error: "Invalid phone number or password" }` | High |
| AUTH-04 | Empty phone | `{"phone":"","password":"pass123"}` | 400 | Error about phone required | High |
| AUTH-05 | Phone with spaces and dashes | `{"phone":"09-123 456 789","password":"pass123"}` | 200 | Spaces/dashes stripped, login succeeds | Medium |
| AUTH-06 | Phone starting with +95 | `{"phone":"+959123456789","password":"pass123"}` | 400 | Rejected — must start with 09 | Medium |
| AUTH-07 | Non-JSON body | Body: `hello` (plain text) | 400 | Error response (`.catch(() => ({}))` handles invalid JSON) | Medium |
| AUTH-08 | Missing password field | `{"phone":"09123456789"}` | 400 | Password required error | High |

**Headers for all:** `Content-Type: application/json`

---

### 2.2 Mobile Registration — `POST /api/mobile/register`

| TC# | Test Case | Request Body | Expected Status | Expected Response | Priority |
|-----|-----------|--------------|-----------------|-------------------|----------|
| AUTH-09 | Valid new user | `{"phone":"09999999999","password":"pass123","name":"Ko Aung"}` | 201 | User object with `role: "user"`, session token | Critical |
| AUTH-10 | Duplicate phone number | Same phone as existing user | 409 | `{ error: "This phone number is already registered" }` | High |
| AUTH-11 | Empty password | `{"phone":"09999999999","password":""}` | 400 | Password required error | High |
| AUTH-12 | Role injection attempt | Add `"role":"admin"` to body | 201 | `user.role` in response is `"user"` — admin plugin blocks role on sign-up | Critical |
| AUTH-13 | Registration bonus credited | Valid registration with bonus enabled (e.g. 200 pts) | 201 | `user.points` in DB equals configured default registration bonus | High |
| AUTH-14 | Optional fields omitted | Only `phone`, `password`, `name` provided | 201 | User created, optional fields (`nrc`, `address`, etc.) null in DB | Medium |
| AUTH-15 | Phone normalization on register | `{"phone":"09-888 888 888",...}` | 201 | Phone stored as `+959888888888` | Medium |

---

## SECTION 3 — AUTHORIZATION & ROLES

### 3.1 Admin Endpoints — Role Guard

| TC# | Test Case | Endpoint | Session | Expected Status | Expected Response | Priority |
|-----|-----------|----------|---------|-----------------|-------------------|----------|
| AUTHZ-01 | No session on admin endpoint | `GET /api/admin/point-purchase-requests` | None | 401 | `{ error: "Unauthorized" }` | Critical |
| AUTHZ-02 | User-role session on admin endpoint | `GET /api/admin/point-purchase-requests` | User cookie | 403 | `{ error: "Forbidden" }` | Critical |
| AUTHZ-03 | Admin session on admin endpoint | `GET /api/admin/point-purchase-requests` | Admin cookie | 200 | Data returned | Critical |
| AUTHZ-04 | Approve with user-role session | `POST /api/admin/point-purchase-requests/[id]/approve` | User cookie | 403 | Forbidden | Critical |
| AUTHZ-05 | Reject with user-role session | `POST /api/admin/point-purchase-requests/[id]/reject` | User cookie | 403 | Forbidden | Critical |
| AUTHZ-06 | Admin pages redirect unauthenticated users | Navigate to `/admin/credit` without login | Redirect or 401 | Login page or Unauthorized | High |

---

### 3.2 Mobile Endpoints — Auth Required vs Public

| TC# | Endpoint | Method | No Token | Expected Status | Notes | Priority |
|-----|----------|--------|----------|-----------------|-------|----------|
| AUTHZ-07 | `/api/mobile/points/purchase-request` | POST | No header | 401 | Auth required | Critical |
| AUTHZ-08 | `/api/mobile/points/purchase-requests` | GET | No header | 401 | Auth required | High |
| AUTHZ-09 | `/api/mobile/premium-dealers/activate` | POST | No header | 401 | Auth required | High |
| AUTHZ-10 | `/api/mobile/premium-dealers/status` | GET | No header | 401 | Auth required | High |
| AUTHZ-11 | `/api/mobile/products/[id]/feature` | POST | No header | 401 | Auth required | High |
| AUTHZ-12 | `/api/mobile/premium-dealers` | GET | No header | 200 | Public endpoint | High |
| AUTHZ-13 | `/api/mobile/point-packages` | GET | No header | 200 | Public endpoint | High |

---

## SECTION 4 — POINT PURCHASE PACKAGES API

### 4.1 GET /api/mobile/point-packages

| TC# | Test Case | Auth | Expected Status | Expected Response | Priority |
|-----|-----------|------|-----------------|-------------------|----------|
| PKG-01 | No packages configured | None | 200 | `{ pointPackages: [], paymentMethods: [] }` | High |
| PKG-02 | Packages configured | None | 200 | `{ pointPackages: [{name, points, priceMmk, ...}], paymentMethods: [{name, accountName, phoneNumber, ...}] }` | Critical |
| PKG-03 | Package with only MMK price | None | 200 | `priceUsd` and `priceKrw` absent or null on that package | Medium |
| PKG-04 | Response is cached | Call twice | None | Second call served from cache — check `Cache-Control` response header | Low |
| PKG-05 | `points` is always integer ≥ 1 | None | 200 | All `pointPackages[].points` values are integers ≥ 1 | Medium |
| PKG-06 | Optional price fields are integers when present | None | 200 | `priceMmk`, `priceUsd`, `priceKrw` are integers ≥ 0 when present | Medium |

---

## SECTION 5 — POINT PURCHASE REQUEST API

### 5.1 POST /api/mobile/points/purchase-request

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

### 5.2 GET /api/mobile/points/purchase-requests

| TC# | Test Case | Auth | Expected Status | Expected Response | Priority |
|-----|-----------|------|-----------------|-------------------|----------|
| HIST-01 | Returns own requests only | Bearer | 200 | `{ requests: [...] }` — only current user's rows | Critical |
| HIST-02 | Does not return other users' requests | User A and User B both have requests | 200 | Each user sees only their own | Critical |
| HIST-03 | Returns transfer fields | Auth | 200 | Each row includes `transferredAmount`, `transferredName`, `transactionReference` | High |
| HIST-04 | Ordered newest first | Multiple requests | 200 | `requests[0].createdAt` is the most recent | Medium |
| HIST-05 | No auth | None | 401 | Unauthorized | High |

---

## SECTION 6 — ADMIN PURCHASE REQUEST REVIEW API

### 6.1 GET /api/admin/point-purchase-requests

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

### 6.2 POST /api/admin/point-purchase-requests/[id]/approve

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

**Step-by-step for APR-01 (full flow):**
1. Note the user's current `points` balance (via DB or user profile endpoint)
2. Submit a purchase request via `POST /api/mobile/points/purchase-request` — note `requestId`
3. Call `POST /api/admin/point-purchase-requests/{requestId}/approve` with admin session
4. Assert response: `pointsAdded` equals the package's `points` value
5. Assert `userBalance` = previous balance + `pointsAdded`
6. Call `GET /api/admin/point-purchase-requests?status=approved` — confirm row appears
7. Call approve again on the same ID — expect 400 `"Request is not pending"`

---

### 6.3 POST /api/admin/point-purchase-requests/[id]/reject

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

## SECTION 7 — PREMIUM DEALER API

### 7.1 POST /api/mobile/premium-dealers/activate

**Headers:** `Authorization: Bearer {token}`, `Content-Type: application/json`

| TC# | Test Case | Body | Expected Status | Expected Response | Priority |
|-----|-----------|------|-----------------|-------------------|----------|
| PD-01 | Activate with sufficient points | `{"packageName":"Basic Package"}` (user has ≥ required pts) | 200 | `{success:true, packageName, pointsUsed, remainingPoints, expiresAt}` | Critical |
| PD-02 | Points deducted from balance | Note balance before, activate | 200 | DB `user.points` = old - `pkg.pointsRequired` | Critical |
| PD-03 | Insufficient points | User has 0 points, package costs 100 | 400 | `"Insufficient points balance"` | Critical |
| PD-04 | Package not found | `{"packageName":"Fake Package"}` | 400 | `"Package not found"` | High |
| PD-05 | `expiresAt` is correct | Activate "Basic Package" (30-day package) | 200 | `expiresAt` ≈ now + 30 days (within 60-second tolerance) | High |
| PD-06 | Atomic write — no partial state | Simulate credit failure | — | Either both writes succeed or neither — points not deducted without status set | Critical |
| PD-07 | Re-activating extends expiry | Activate, then activate again | 200 | New `expiresAt` = now + duration (not additive) | Medium |
| PD-08 | `packageName` too long | 121-character string | 400 | Validation error (max 120 chars) | Low |
| PD-09 | No auth | — | 401 | Unauthorized | High |

---

### 7.2 GET /api/mobile/premium-dealers/status

**Headers:** `Authorization: Bearer {token}`

| TC# | Test Case | Setup | Expected Status | Expected Response | Priority |
|-----|-----------|-------|-----------------|-------------------|----------|
| PD-10 | Active status | User activated recently | 200 | `{active:true, packageName, expiresAt, serviceFeePercent, transactionLimitUsd}` | High |
| PD-11 | Never activated | New user, never activated | 200 | `{active:false}` | High |
| PD-12 | Expired status | Set `premiumDealerExpiresAt` to past date in DB | 200 | `{active:false}` | High |
| PD-13 | No auth | — | 401 | Unauthorized | High |

---

### 7.3 GET /api/mobile/premium-dealers (Public List)

| TC# | Test Case | Setup | Auth | Expected Status | Expected Response | Priority |
|-----|-----------|-------|------|-----------------|-------------------|----------|
| PD-14 | Returns active dealers only | One active, one expired dealer | None | 200 | `{premiumDealers:[...]}` — expired dealer absent | Critical |
| PD-15 | Returns correct fields | Active dealer exists | None | 200 | Each item has `userId`, `name`, `username`, `packageName`, `expiresAt` | High |
| PD-16 | Empty list when none active | No active dealers | None | 200 | `{premiumDealers:[]}` | Medium |
| PD-17 | Response is cached | Call twice | None | 200 | `Cache-Control` header set on response | Low |

---

## SECTION 8 — FEATURE PRODUCT API

### 8.1 POST /api/mobile/products/[id]/feature

**Headers:** `Authorization: Bearer {token}`, `Content-Type: application/json`

| TC# | Test Case | Body | Expected Status | Expected Response | Priority |
|-----|-----------|------|-----------------|-------------------|----------|
| FT-01 | Feature own product — valid tier | `{"durationDays":7,"points":500}` (owner, sufficient balance) | 200 | `{success:true, productId, durationDays:7, pointsUsed:500, remainingPoints}` | Critical |
| FT-02 | `featuredExpiresAt` set correctly | Feature for 7 days | 200 | DB `featuredExpiresAt` ≈ now + 7 days (within 60-second tolerance) | Critical |
| FT-03 | Points deducted atomically | Note balance before | 200 | DB `user.points` = old - 500 | Critical |
| FT-04 | Insufficient points | User has 100 pts, tier costs 500 | 400 | `"Insufficient points balance"` | Critical |
| FT-05 | Feature someone else's product | Authenticated as non-owner | 403 | `"Forbidden"` | Critical |
| FT-06 | Product not found | Random product ID | 404 | `"Product not found"` | High |
| FT-07 | Invalid tier — durationDays not in settings | `{"durationDays":99,"points":500}` | 400 | `"Invalid duration or points tier"` | High |
| FT-08 | Invalid tier — points not matching | `{"durationDays":7,"points":999}` | 400 | `"Invalid duration or points tier"` | High |
| FT-09 | Homepage limit reached | Fill all featured slots, try to feature another | 400 | `"Homepage featured limit reached (N)..."` | High |
| FT-10 | Expired featured slot not counted in limit | Set one `featuredExpiresAt` to past in DB | 200 | Expired slot freed up, feature succeeds | High |
| FT-11 | GET method returns 405 | `GET /api/mobile/products/[id]/feature` | 405 | Error message with hint to use POST | Low |
| FT-12 | No auth | — | 401 | Unauthorized | Critical |

**Step-by-step for FT-01:**
1. Login as the product owner → get token
2. Ensure user has ≥ 500 points (top up via admin if needed)
3. Note current `user.points` balance
4. Confirm a tier with `durationDays:7, points:500` exists in Feature Settings
5. `POST /api/mobile/products/{productId}/feature` with body `{"durationDays":7,"points":500}`
6. Assert response: `success:true`, `pointsUsed:500`, `remainingPoints` = old balance - 500
7. Check DB `product` row: `is_featured=true`, `featured_expires_at` ≈ now + 7 days
8. Call `GET /api/mobile/products?isFeatured=true` — product appears in list

---

## SECTION 9 — SESSION & ERROR HANDLING

| TC# | Test Case | Steps | Expected Result | Priority |
|-----|-----------|-------|-----------------|----------|
| SES-01 | Expired / invalid bearer token | Use a malformed or old token on any protected endpoint | 401 Unauthorized | High |
| SES-02 | All API errors return JSON | Call any endpoint with wrong method or bad input | Response is `application/json`, not HTML error page | High |
| SES-03 | DB failure returns 500 JSON | Simulate DB unavailable | `{ error: "..." }` JSON response with 500 — no stack trace exposed | High |
| SES-04 | Admin session persists across navigation | Login as admin, navigate to multiple pages | Still logged in, no re-auth required | High |
| ERR-01 | Malformed JSON body | Send `Content-Type: application/json` with body `{broken` | 400 — `.catch(() => ({}))` handles it, returns validation error | Medium |
| ERR-02 | Missing Content-Type header | POST without Content-Type | Body treated as empty `{}`, validation fails with 400 | Medium |
| ERR-03 | Extra unknown fields ignored | Send valid body + `"injected":"evil"` | 200 — Zod strips unknown keys silently | Medium |
| ERR-04 | Very large body | Send 10MB JSON payload | 400 or 413 — server rejects before processing | Low |

---

## SECTION 10 — INTEGRATION FLOWS (End-to-End)

### E2E-01: Full Point Purchase Flow

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

**Priority:** Critical

---

### E2E-02: Rejected Request — No Points Credited

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Note user's current `points` balance | Baseline recorded |
| 2 | Submit purchase request | Pending row created |
| 3 | Admin clicks Reject with reason "Transfer not received" | `status → rejected` |
| 4 | Check user balance | Unchanged from baseline |

**Priority:** Critical

---

### E2E-03: Full Premium Dealer Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin configures "Basic Package" (100 pts, 30 days) | Settings saved |
| 2 | Give user 200 points (approve a purchase request or set manually) | User has 200 pts |
| 3 | `POST /api/mobile/premium-dealers/activate` `{"packageName":"Basic Package"}` | 200 — `expiresAt` = now+30d, balance = 100 |
| 4 | `GET /api/mobile/premium-dealers/status` | `{active:true, packageName:"Basic Package"}` |
| 5 | `GET /api/mobile/premium-dealers` | User appears in list |
| 6 | Set `premium_dealer_expires_at` to past in DB | — |
| 7 | `GET /api/mobile/premium-dealers/status` | `{active:false}` |
| 8 | `GET /api/mobile/premium-dealers` | User no longer in list |

**Priority:** High

---

### E2E-04: Full Feature Product Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin configures tier: 7 days = 500 pts | Settings saved |
| 2 | User has 500 pts, owns a product | Setup confirmed |
| 3 | `POST /api/mobile/products/{id}/feature` `{"durationDays":7,"points":500}` | 200 — `featuredExpiresAt` set |
| 4 | `GET /api/mobile/products?isFeatured=true` | Product appears in featured list |
| 5 | Set `featured_expires_at` to past in DB | — |
| 6 | `GET /api/mobile/products?isFeatured=true` | Product no longer in featured list |

**Priority:** High

---

### E2E-05: Registration Bonus

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin sets Default Points = 200, enables Registration Bonus | Settings saved |
| 2 | Register a new user via `POST /api/mobile/register` | 201 response |
| 3 | Check `user.points` in DB for the new user | Equals 200 |

**Priority:** High

---

### E2E-06: Double Approve Prevention

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit purchase request (100 pts) | Pending row |
| 2 | Admin approves — balance goes from 0 → 100 | Success |
| 3 | Admin tries to approve same request again | 400 `"Request is not pending"` |
| 4 | Check balance | Still 100 — no double credit |

**Priority:** Critical

---

## Priority Legend

| Level | Meaning |
|-------|---------|
| **Critical** | System unusable or security breach if this fails |
| **High** | Core feature broken, direct user-facing impact |
| **Medium** | Edge case or secondary feature affected |
| **Low** | Cosmetic issue or very rare edge case |

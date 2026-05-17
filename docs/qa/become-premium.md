# QA — Become Premium

> **Feature:** Premium Dealer activation — packages, status, activation, public list  
> **Screen:** "Become Premium" mobile screen (15 · premium.jsx)  
> **Endpoints:**
> - `GET /api/mobile/premium-dealers/settings` — package list with recommended flag (public)
> - `GET /api/mobile/premium-dealers/status` — user balance + active status (auth required)
> - `POST /api/mobile/premium-dealers/activate` — spend points to activate (auth required)
> - `GET /api/mobile/premium-dealers` — public list of active premium dealers

---

## How the screen works

The mobile "Become Premium" screen uses **two parallel API calls** to bootstrap:

```
GET /api/mobile/premium-dealers/settings   (no auth) → package list
GET /api/mobile/premium-dealers/status     (bearer)  → user balance + active status
```

Based on the response it renders one of three states:

| State | Condition | What the user sees |
|-------|-----------|--------------------|
| **Not premium, can afford** | `active:false`, `points ≥ selected package cost` | Package picker, progress bar full, Activate button |
| **Not premium, can't afford** | `active:false`, `points < selected package cost` | Progress bar partial, "need X more points" warning, "Buy pts + activate" CTA |
| **Already premium** | `active:true` | "You're a Premium Dealer" hero, days remaining, autoRenew toggle, no package picker |

---

## 1. GET /api/mobile/premium-dealers/settings

**Auth:** None required (public, cached)

**Response shape:**
```json
{
  "premiumDealerPackages": [
    { "name": "Basic Package",    "pointsRequired": 100, "durationDays": 30,  "recommended": false },
    { "name": "Standard Package", "pointsRequired": 250, "durationDays": 100, "recommended": true  },
    { "name": "Premium Package",  "pointsRequired": 500, "durationDays": 200, "recommended": false }
  ]
}
```

| TC# | Test Case | Setup | Expected Status | Expected Response | Priority |
|-----|-----------|-------|-----------------|-------------------|----------|
| PDC-01 | Returns all configured packages | Admin has 3 packages configured | 200 | Array of 3 packages with `name`, `pointsRequired`, `durationDays`, `recommended` | Critical |
| PDC-02 | `recommended:true` on second package only | 3+ packages configured | 200 | Only index 1 has `recommended:true`; all others `false` | High |
| PDC-03 | `recommended:false` when only 1 package | Admin configures only 1 package | 200 | Single package has `recommended:false` | Medium |
| PDC-04 | Default packages used when none configured | `premium_dealers_packages_json` not set in DB | 200 | Returns 3 default packages (Basic/Standard/Premium) | High |
| PDC-05 | Response is cached | Call endpoint twice in quick succession | 200 | `Cache-Control` header present on both responses | Low |
| PDC-06 | No auth required | Call without `Authorization` header | 200 | Returns packages normally — no 401 | High |
| PDC-07 | `pointsRequired` is integer ≥ 0 | Any config | 200 | All `pointsRequired` values are non-negative integers | Medium |
| PDC-08 | `durationDays` is integer ≥ 1 | Any config | 200 | All `durationDays` values are positive integers | Medium |

---

## 2. GET /api/mobile/premium-dealers/status

**Headers:** `Authorization: Bearer {token}`

**Response shape — inactive user:**
```json
{ "points": 350, "active": false }
```

**Response shape — active user:**
```json
{
  "points": 900,
  "active": true,
  "packageName": "Standard Package",
  "expiresAt": "2026-08-28T00:00:00.000Z",
  "daysRemaining": 42,
  "autoRenew": true
}
```

| TC# | Test Case | Setup | Expected Status | Expected Response | Priority |
|-----|-----------|-------|-----------------|-------------------|----------|
| PDS-01 | Returns points balance when inactive | New user with 350 pts, never activated | 200 | `{points:350, active:false}` — no `packageName`, `expiresAt`, `daysRemaining`, `autoRenew` fields | Critical |
| PDS-02 | Returns full status when active | User activated Standard Package (100 days) | 200 | All 6 fields present: `points`, `active`, `packageName`, `expiresAt`, `daysRemaining`, `autoRenew` | Critical |
| PDS-03 | `daysRemaining` is correct | Activate package, call immediately | 200 | `daysRemaining` equals `durationDays` of selected package (± 1 day tolerance) | High |
| PDS-04 | `autoRenew:true` reflected | Activate with `"autoRenew":true` | 200 | `autoRenew:true` in response | High |
| PDS-05 | `autoRenew:false` reflected | Activate with `"autoRenew":false` | 200 | `autoRenew:false` in response | High |
| PDS-06 | Expired package shows `active:false` | Set `premium_dealer_expires_at` to yesterday in DB | 200 | `{points:N, active:false}` — no premium fields | Critical |
| PDS-07 | Zero points (fresh user) | New registration, no points added | 200 | `{points:0, active:false}` | Medium |
| PDS-08 | No auth | — | 401 | Unauthorized | High |
| PDS-09 | `points` decreases after activation | Record balance before and after activate | 200 | `points` in status response = old balance − `pointsRequired` | Critical |

**Step-by-step for PDS-02:**
1. Register (or login as) a test user → get bearer token
2. Via admin: credit user with 500 points
3. Via admin settings: ensure "Standard Package" (250 pts, 100 days) is configured
4. `POST /api/mobile/premium-dealers/activate` with body `{"packageName":"Standard Package","autoRenew":true}`
5. `GET /api/mobile/premium-dealers/status` with bearer token
6. Assert all fields:
   - `active: true`
   - `packageName: "Standard Package"`
   - `daysRemaining`: 99 or 100
   - `autoRenew: true`
   - `points`: 500 − 250 = 250

---

## 3. POST /api/mobile/premium-dealers/activate

**Headers:** `Authorization: Bearer {token}`, `Content-Type: application/json`

**Request body:**
```json
{ "packageName": "Standard Package", "autoRenew": true }
```

| TC# | Test Case | Body | Expected Status | Expected Response | Priority |
|-----|-----------|------|-----------------|-------------------|----------|
| PDA-01 | Activate with sufficient points | `{"packageName":"Basic Package","autoRenew":false}` (user has ≥ 100 pts) | 200 | `{success:true, packageName, pointsUsed, remainingPoints, startDate, expiresAt, autoRenew, status:"active"}` | Critical |
| PDA-02 | Points deducted from balance | Note balance before, activate | 200 | `remainingPoints` = old balance − `pointsRequired` | Critical |
| PDA-03 | `expiresAt` is correct | Activate "Basic Package" (30-day package) | 200 | `expiresAt` ≈ now + 30 days (within 60-second tolerance) | High |
| PDA-04 | `autoRenew:true` stored | Activate with `autoRenew:true` | 200 | `autoRenew:true` in response; confirmed in `GET /status` | High |
| PDA-05 | `autoRenew:false` stored | Activate with `autoRenew:false` | 200 | `autoRenew:false` in response | High |
| PDA-06 | Insufficient points | User has 0 points, package costs 100 | 400 | `"Insufficient points balance"` | Critical |
| PDA-07 | Package not found | `{"packageName":"Fake Package","autoRenew":false}` | 400 | `"Package not found"` | High |
| PDA-08 | `autoRenew` field missing | `{"packageName":"Basic Package"}` | 400 | `"Invalid input"` (Zod requires boolean) | High |
| PDA-09 | `packageName` too long | 121-character string | 400 | Validation error (max 120 chars) | Low |
| PDA-10 | Atomic write — no partial state | Simulate mid-transaction failure | — | Either both point deduction + status set succeed, or neither — no half state | Critical |
| PDA-11 | Re-activating overwrites expiry | Activate, then activate again | 200 | New `expiresAt` = now + duration (not additive on top of old) | Medium |
| PDA-12 | No auth | — | 401 | Unauthorized | High |

**Step-by-step for PDA-01:**
1. Login as test user → get bearer token
2. Via admin: ensure user has ≥ 100 points; confirm "Basic Package" (100 pts, 30 days) is configured
3. Note current points balance
4. `POST /api/mobile/premium-dealers/activate` with body `{"packageName":"Basic Package","autoRenew":false}`
5. Assert response:
   - `success: true`
   - `packageName: "Basic Package"`
   - `pointsUsed: 100`
   - `remainingPoints` = previous balance − 100
   - `expiresAt` ≈ now + 30 days
   - `autoRenew: false`
   - `status: "active"`
6. `GET /api/mobile/premium-dealers/status` — confirm `active:true` with correct fields
7. `GET /api/mobile/premium-dealers` — confirm user appears in the public list

---

## 4. GET /api/mobile/premium-dealers (Public List)

**Auth:** None required

| TC# | Test Case | Setup | Expected Status | Expected Response | Priority |
|-----|-----------|-------|-----------------|-------------------|----------|
| PDL-01 | Returns active dealers only | One active dealer + one whose `expiresAt` is past | 200 | Only active dealer in list; expired dealer absent | Critical |
| PDL-02 | Returns correct fields per dealer | Active dealer exists | 200 | Each item has: `userId`, `name`, `username`, `image`, `city`, `ratingScore`, `packageName`, `startDate`, `expiresAt`, `autoRenew`, `presence`, `status`, `lastSeenAt` | High |
| PDL-03 | Empty list when no active dealers | No active dealers in DB | 200 | `{premiumDealers:[]}` | Medium |
| PDL-04 | No auth required | Call without `Authorization` header | 200 | Returns list normally — no 401 | High |
| PDL-05 | `presence` field is "online" or "offline" | Call endpoint | 200 | All `presence` values are exactly `"online"` or `"offline"` | Medium |
| PDL-06 | `ratingScore` is 0 when no ratings | New dealer with no seller ratings | 200 | `ratingScore: 0` | Medium |

---

## E2E Flows

### E2E-BP-01: Happy Path — Sufficient Balance

**Priority:** Critical  
**Preconditions:** User is logged in; user has ≥ 250 points; admin has configured Standard Package (250 pts, 100 days).

| Step | Action | Endpoint | Expected Result |
|------|--------|----------|-----------------|
| 1 | Screen opens — load balance + active status | `GET /api/mobile/premium-dealers/status` (bearer) | `{points:≥250, active:false}` |
| 2 | Screen opens — load packages | `GET /api/mobile/premium-dealers/settings` (no auth) | 3 packages; index 1 `recommended:true` |
| 3 | Verify Standard Package is pre-selected | Client-side | "Standard Package" selected by default |
| 4 | Verify hero card shows 250 pts / 100 days | Client-side | Correct cost and duration shown |
| 5 | Verify progress bar is full | Client-side (balance ≥ cost) | No "need X more points" warning |
| 6 | Tap "Activate Standard for 250 pts" | Client-side — opens confirmation sheet | Sheet shows: balance, −250 pts deduction, after-activation balance, autoRenew checkbox |
| 7 | Confirm with autoRenew ON | `POST /api/mobile/premium-dealers/activate` `{"packageName":"Standard Package","autoRenew":true}` | 200 — `{success:true, remainingPoints:oldBalance−250, expiresAt}` |
| 8 | Screen reloads status | `GET /api/mobile/premium-dealers/status` | `{active:true, packageName:"Standard Package", daysRemaining:100, autoRenew:true, points:oldBalance−250}` |
| 9 | Hero card shows active state | Client-side | "You're a Premium Dealer" title; days remaining displayed |
| 10 | Verify in public list | `GET /api/mobile/premium-dealers` (no auth) | User's entry present with `packageName:"Standard Package"` |

---

### E2E-BP-02: Insufficient Balance — Top-Up Path

**Priority:** High  
**Preconditions:** User has 50 points; Basic Package costs 100 pts.

| Step | Action | Endpoint | Expected Result |
|------|--------|----------|-----------------|
| 1 | Screen opens | `GET /api/mobile/premium-dealers/status` | `{points:50, active:false}` |
| 2 | User selects Basic Package (100 pts) | Client-side | Progress bar shows 50% fill (50/100) |
| 3 | "Need more points" warning shown | Client-side | Banner: "You need 50 more points. Top up below to activate in one step." |
| 4 | Primary CTA is changed | Client-side | Button reads "Buy 50 pts + activate Basic" |
| 5 | User taps "Buy points" CTA | Client-side navigation | Navigates to coins/top-up screen; no activate call made |
| 6 | User buys points, returns with 150 pts | `GET /api/mobile/premium-dealers/status` | `{points:150, active:false}` |
| 7 | Warning banner gone; normal CTA shown | Client-side | Progress bar full; normal activate button visible |
| 8 | Activate succeeds | `POST /api/mobile/premium-dealers/activate` `{"packageName":"Basic Package","autoRenew":false}` | 200 |

---

### E2E-BP-03: Already Active — Manage State

**Priority:** High  
**Preconditions:** User already has an active Standard Package (autoRenew:true).

| Step | Action | Endpoint | Expected Result |
|------|--------|----------|-----------------|
| 1 | Screen opens | `GET /api/mobile/premium-dealers/status` | `{active:true, packageName:"Standard Package", daysRemaining:N, autoRenew:true, points:N}` |
| 2 | Package selector is hidden | Client-side | No "CHOOSE A PACKAGE" section rendered |
| 3 | Balance / progress bar section is hidden | Client-side | No "YOUR BALANCE" section rendered |
| 4 | Hero card shows active state | Client-side | "You're a Premium Dealer" + package name + days remaining |
| 5 | AutoRenew pill shows "on" | Client-side | Pill reads "Auto-renew is on" with "Turn off" button |
| 6 | Tap "Turn off" auto-renew | Client-side toggle | Pill updates to "Auto-renew is off" (client-side only in current design) |
| 7 | CTA is "View my premium profile" | Client-side | Button navigates to seller profile screen |

---

### E2E-BP-04: Full Lifecycle — Expiry

**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin configures "Basic Package" (100 pts, 30 days) | Settings saved |
| 2 | Give user 200 points (approve a purchase request or set in DB) | User has 200 pts |
| 3 | `POST /api/mobile/premium-dealers/activate` `{"packageName":"Basic Package","autoRenew":false}` | 200 — `expiresAt` = now+30d, balance = 100 |
| 4 | `GET /api/mobile/premium-dealers/status` | `{active:true, packageName:"Basic Package", daysRemaining:30, autoRenew:false, points:100}` |
| 5 | `GET /api/mobile/premium-dealers` | User appears in the public list |
| 6 | Manually set `premium_dealer_expires_at` to yesterday in DB | — |
| 7 | `GET /api/mobile/premium-dealers/status` | `{points:100, active:false}` — no premium fields |
| 8 | `GET /api/mobile/premium-dealers` | User no longer in the public list |

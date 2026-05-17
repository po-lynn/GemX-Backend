# QA — Feature Product

> **Feature:** Feature a product on the homepage  
> **Endpoint:** `POST /api/mobile/products/[id]/feature`

---

## 1. POST /api/mobile/products/[id]/feature

**Headers:** `Authorization: Bearer {token}`, `Content-Type: application/json`

| TC# | Test Case | Body | Expected Status | Expected Response | Priority |
|-----|-----------|------|-----------------|-------------------|----------|
| FT-01 | Feature own product — valid tier | `{"durationDays":7,"points":500}` (owner, sufficient balance) | 200 | `{success:true, productId, durationDays:7, pointsUsed:500, remainingPoints}` | Critical |
| FT-02 | `featuredExpiresAt` set correctly | Feature for 7 days | 200 | DB `featuredExpiresAt` ≈ now + 7 days (within 60-second tolerance) | Critical |
| FT-03 | Points deducted atomically | Note balance before | 200 | DB `user.points` = old − 500 | Critical |
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
1. Login as the product owner → get bearer token
2. Ensure user has ≥ 500 points (top up via admin if needed)
3. Note current `user.points` balance
4. Confirm a tier with `durationDays:7, points:500` exists in Feature Settings
5. `POST /api/mobile/products/{productId}/feature` with body `{"durationDays":7,"points":500}`
6. Assert response: `success:true`, `pointsUsed:500`, `remainingPoints` = old balance − 500
7. Check DB `product` row: `is_featured=true`, `featured_expires_at` ≈ now + 7 days
8. Call `GET /api/mobile/products?isFeatured=true` — product appears in list

---

## E2E Flow

### E2E-FT-01: Full Feature Product Flow

**Priority:** High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin configures tier: 7 days = 500 pts | Settings saved |
| 2 | User has 500 pts, owns a product | Setup confirmed |
| 3 | `POST /api/mobile/products/{id}/feature` `{"durationDays":7,"points":500}` | 200 — `featuredExpiresAt` set |
| 4 | `GET /api/mobile/products?isFeatured=true` | Product appears in featured list |
| 5 | Manually set `featured_expires_at` to past in DB | — |
| 6 | `GET /api/mobile/products?isFeatured=true` | Product no longer in featured list |

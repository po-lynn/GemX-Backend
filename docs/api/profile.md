# GET /api/profile

## Endpoint

`GET /api/profile`

## Auth

Bearer token (Better Auth session). Required.

## Request

**Headers:** `Authorization: Bearer <session_token>`

**Query (optional):** Pagination and product filters for the embedded products list: `page`, `limit`, `search`, `productType`, `categoryId`, `stoneCut`, `shape`, `origin`, `laboratoryId`. Products are always restricted to `status=active`.

## Response

**200** — `{ "profile": { ... }, "products": { "products": [...], "total": n } }`

`profile` includes `verified` (boolean, from `user.verified`, admin-set) alongside `emailVerified`, `isPremiumDealer`, and other user fields. See `docs/MOBILE-API.md` section **5.4** for the full shape.

**401** — `{ "error": "Unauthorized" }`

**404** — `{ "error": "Profile not found" }`

**500** — `{ "error": "Failed to fetch profile" }`

## Example

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/profile?page=1&limit=20"
```

```json
{
  "profile": {
    "id": "user-uuid",
    "name": "Jane",
    "verified": true,
    "emailVerified": true,
    "isPremiumDealer": false
  },
  "products": { "products": [], "total": 0 }
}
```

## Mobile

Yes — consumed by the mobile app (`GET /api/profile`).

---

# GET /api/profile/:id

## Endpoint

`GET /api/profile/:id`

## Auth

None (public seller profile).

## Response

**200** — `{ "profile": { ... }, "products": { "products": [...], "total": n } }`

`profile` includes `verified` (boolean, from `user.verified`, admin-set) alongside `presence`, `status`, `lastSeenAt`, and `isPremiumDealer`. See `docs/MOBILE-API.md` section **5.4a**.

**404** — `{ "error": "Profile not found" }`

## Example

```bash
curl -s "http://localhost:3000/api/profile/SELLER_UUID"
```

## Mobile

Yes — public seller profile for the mobile app.

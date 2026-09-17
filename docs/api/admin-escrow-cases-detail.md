# GET /api/admin/escrow-cases/[id]

Route file: `app/api/admin/escrow-cases/[id]/route.ts`. Full case context for
the thread view's context panel.

**Auth:** `requireEscrowCaseAccess(request, id)`
(`features/escrow-cases/lib/case-access.ts`). Row-level, feature-local check —
not folded into `lib/api-guard.ts` because it also needs the case row itself.
Exact logic, in order:

1. No session → `401 Unauthorized`.
2. `getEscrowCaseById(id)` returns nothing → `404 Not found`.
3. `session.user.role === "admin"` → **scope `"admin"`**, full access to any case.
4. `session.user.role !== "internal"` (i.e. neither `admin` nor `internal`) → `403 Forbidden`.
5. Otherwise look up `getStaffRole(session.user.id)`:
   - `staffRole.role === "escrow_agent"`:
     - `staffRole.isSupervisor === true` → **scope `"supervisor"`**, any case.
     - Otherwise, only if **both** `escrowCase.assignedAgentId === session.user.id`
       **and** `checkInternalAccess(session.user.id, FEATURE_KEYS.ESCROW_CASES)`
       (`"escrow.cases"`) are true → **scope `"own"`**. Otherwise → `403 Forbidden`.
   - `staffRole.role === "moderator"` **and**
     `checkInternalAccess(session.user.id, FEATURE_KEYS.CHAT_MODERATION)`
     (`"chat.moderation"`) → **scope `"moderation"`** (read-only oversight —
     this route is a `GET`, so moderation scope is fully permitted here).
   - Any other staff role (`support`, `analyst`), no staff role row, or the
     feature-key check above fails → `403 Forbidden`.

**Mobile flag:** Not consumed by the mobile app — admin-only.

## Request

Path params:

| Param | Type   | Required | Notes                  |
|-------|--------|----------|--------------------------|
| `id`  | string | yes      | Escrow case id (`escrow_case.id`) |

No query params, no body.

## Response

`200 OK`:

```json
{
  "success": true,
  "case": {
    "id": "case-1",
    "buyerId": "usr_buyer",
    "sellerId": "usr_seller",
    "listingId": "product-1",
    "assignedAgentId": "usr_agent",
    "state": "agent_assigned",
    "listingTitle": "2.10ct Oval Sapphire",
    "agreedPriceMinor": 250000,
    "currency": "USD",
    "feeBps": 250,
    "buyerFeeShareBps": 5000,
    "sellerFeeShareBps": 5000,
    "feeMinMinor": null,
    "feeCapMinor": null,
    "stateEnteredAt": "2026-09-15T09:30:00.000Z",
    "nextActionNote": null,
    "buyer": { "id": "usr_buyer", "name": "Jane Doe", "image": null },
    "seller": { "id": "usr_seller", "name": "John Roe", "image": null }
  }
}
```

`state` is one of `requested | agent_assigned | verification |
payment_pending | handover_scheduled | handover_confirmed | completed |
cancelled | rejected | disputed` (`EscrowCaseState`,
`drizzle/schema/escrow-case-schema.ts`). `currency` is `"USD" | "MMK"`.

### Errors

| Status | Body                                     | Cause                                                                                                   |
|--------|--------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| 401    | `{ "error": "Unauthorized" }`              | No session                                                                                                    |
| 403    | `{ "error": "Forbidden" }`                 | Caller has none of the access scopes above (see `requireEscrowCaseAccess` steps 4–5)                        |
| 404    | `{ "error": "Not found" }`                 | No case with that `id`. Checked both in `requireEscrowCaseAccess` (via `getEscrowCaseById`) and again in the handler (via `getEscrowCaseDetail`) — the second check is a safety net and is not expected to trigger once the first has passed. |
| 500    | `{ "error": "Failed to load escrow case" }`| Unexpected server error                                                                                       |

## Example

```bash
curl -s \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  "http://localhost:3000/api/admin/escrow-cases/case-1"
```

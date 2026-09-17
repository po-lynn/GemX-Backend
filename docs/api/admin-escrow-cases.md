# /api/admin/escrow-cases

Covers `GET` (case list) and `POST` (case creation). Route file:
`app/api/admin/escrow-cases/route.ts`.

**Mobile flag:** Not consumed by the mobile app — admin-only. There is no
mobile case-creation endpoint (see the feature brief's scope note); cases are
always staff-initiated from the admin panel.

---

## GET /api/admin/escrow-cases

**Auth:** `requireAdminOrAnyFeature(request, [FEATURE_KEYS.ESCROW_CASES,
FEATURE_KEYS.CHAT_MODERATION])` (`lib/api-guard.ts`) — as of Step 6, either
key alone is enough:

- No session → `401`.
- `role === "admin"` → passes the gate.
- `role === "internal"` holding **either** the `escrow.cases` or the
  `chat.moderation` RBAC permission (`checkInternalAccess`) → passes the
  gate. (Before Step 6, only `escrow.cases` was accepted — a pure chat
  moderator had no listing endpoint to discover a case id through.)
- Anything else → `403`.

Passing the gate only proves the caller may open the endpoint — the actual
**row scope** returned is decided in the route handler itself, not by the
feature key:

- `session.user.role === "admin"` → sees every case (`assignedAgentId` filter
  left `undefined`).
- `role === "internal"`: the handler looks up `getStaffRole(session.user.id)`.
  - `staffRole.role === "moderator"` → sees every case, read-only (same
    breadth as a supervisor; per-case write access is still independently
    enforced by `requireEscrowThreadWriteAccess` on the `[id]` routes — this
    list endpoint never exposes a write action a moderator could take).
  - `staffRole.role === "escrow_agent"` and `staffRole.isSupervisor === true`
    → sees every case, same as admin.
  - Anything else (a plain `escrow_agent`, a `support`/`analyst` staff role,
    or no staff role row at all) → `assignedAgentId` is forced to the
    caller's own `session.user.id`, so `listEscrowCasesForViewer` only
    returns cases where `escrow_case.assigned_agent_id` equals the caller —
    the conservative default. A non-agent with no cases assigned to them
    simply sees an empty list.

Note this is a simpler check than `features/escrow-cases/lib/case-access.ts`
(used by the `[id]` routes): it decides breadth once for the whole list,
rather than per case.

### Request

No path params. Query params (all optional — real server-side search, added
in Step 6, replacing what used to be a pure client-side substring filter):

| Param          | Type      | Notes                                                              |
|----------------|-----------|---------------------------------------------------------------------|
| `q`            | `string`  | Substring match (`ILIKE`, case-insensitive) against buyer name, seller name, and listing title. ≤200 chars. |
| `state`        | `string`  | One of `escrow_case_state`'s enum values — exact match.              |
| `reportedOnly` | `"true"`  | Only cases with at least one **open** `message_report` against one of their case messages. Any other value (including omitted) means "no filter." |
| `dateFrom`     | ISO datetime | Inclusive lower bound on `state_entered_at`.                    |
| `dateTo`       | ISO datetime | Inclusive upper bound on `state_entered_at`.                    |

Message *content* search is intentionally not supported here — see
`docs/technical/escrow-case-messaging.md`'s edge case #20 for why.

No body.

### Response

`200 OK`:

```json
{
  "success": true,
  "cases": [
    {
      "id": "case-1",
      "buyer": { "id": "usr_buyer", "name": "Jane Doe", "image": null },
      "seller": { "id": "usr_seller", "name": "John Roe", "image": null },
      "listingId": "product-1",
      "listingTitle": "2.10ct Oval Sapphire",
      "assignedAgentId": "usr_agent",
      "state": "agent_assigned",
      "stateEnteredAt": "2026-09-15T09:30:00.000Z",
      "agreedPriceMinor": 250000,
      "currency": "USD",
      "hasUnread": true,
      "lastMessageAt": "2026-09-15T10:02:00.000Z"
    }
  ]
}
```

Ordering (`listEscrowCasesForViewer` in `features/escrow-cases/db/escrow-cases.ts`):
unread cases first (`hasUnread DESC`), then oldest `stateEnteredAt` first
(SLA-age order) — mirrors the Queue Console's "oldest unattended first"
convention.

#### Errors

| Status | Body                                            | Cause                                                          |
|--------|--------------------------------------------------|-----------------------------------------------------------------|
| 400    | `{ "error": "Invalid query" }`                   | A query param failed validation (e.g. `state` isn't a real enum value, `dateFrom`/`dateTo` isn't a valid ISO datetime) |
| 401    | `{ "error": "Unauthorized" }`                    | No session                                                       |
| 403    | `{ "error": "Forbidden" }`                       | Not admin, and not internal with `escrow.cases` or `chat.moderation` |
| 500    | `{ "error": "Failed to load escrow cases" }`     | Unexpected server error                                          |

### Example

```bash
curl -s \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  "http://localhost:3000/api/admin/escrow-cases?q=jane&state=verification&reportedOnly=true"
```

---

## POST /api/admin/escrow-cases

**Auth:** identical gate to `GET` above —
`requireAdminOrFeature(request, FEATURE_KEYS.ESCROW_CASES)`. Unlike `GET`,
there is **no additional row-scope narrowing**: any caller who passes the
gate (admin, or internal with the `escrow.cases` permission — supervisor or
plain agent alike) may create a case for any `buyerId`/`sellerId`/`listingId`
combination and optionally assign it to any agent.

### Request

Body — `createCaseSchema` in `app/api/admin/escrow-cases/route.ts`:

| Field              | Type                                    | Required | Constraint                                  |
|--------------------|------------------------------------------|----------|----------------------------------------------|
| `buyerId`          | `string`                                  | yes      | `.trim().min(1)`                              |
| `sellerId`         | `string`                                  | yes      | `.trim().min(1)`; must differ from `buyerId`  |
| `listingId`        | `string`                                  | yes      | `.trim().min(1)`                              |
| `assignedAgentId`  | `string`                                  | no       | `.trim().min(1)` when present                 |
| `agreedPriceMinor` | `number`                                  | yes      | `.int().positive()` (integer minor units)     |
| `currency`         | `"USD" \| "MMK"`                          | yes      | `z.enum(currencyEnum.enumValues)`             |

`buyerId === sellerId` is rejected even though the Zod schema alone would
accept it — checked explicitly in the route after parsing.

Fee terms (`feeBps`, `buyerFeeShareBps`, `sellerFeeShareBps`, `feeMinMinor`,
`feeCapMinor`) are **not** client-supplied — `createEscrowCase` snapshots
them server-side from the latest `escrow_service_setting` row so an
in-flight case's fee never changes retroactively if the global config is
edited later. `state` is also server-computed: `"agent_assigned"` if
`assignedAgentId` was given, otherwise `"requested"`.

### Response

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
    "state": "agent_assigned"
  }
}
```

#### Errors

| Status | Body                                                        | Cause                                                          |
|--------|---------------------------------------------------------------|-------------------------------------------------------------------|
| 400    | `{ "error": "Invalid input" }`                                | Body missing/malformed, or fails `createCaseSchema`               |
| 400    | `{ "error": "Buyer and seller must be different users" }`    | `buyerId === sellerId`                                             |
| 401    | `{ "error": "Unauthorized" }`                                 | No session                                                         |
| 403    | `{ "error": "Forbidden" }`                                    | Not admin, and not internal with the `escrow.cases` permission    |
| 500    | `{ "error": "Failed to create escrow case" }`                 | Unexpected server error                                            |

### Example

```bash
curl -s -X POST \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"buyerId":"usr_buyer","sellerId":"usr_seller","listingId":"product-1","agreedPriceMinor":250000,"currency":"USD"}' \
  "http://localhost:3000/api/admin/escrow-cases"
```

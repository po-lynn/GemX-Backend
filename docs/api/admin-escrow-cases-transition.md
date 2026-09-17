# /api/admin/escrow-cases/[id]/transition

`POST` — drive the case's state machine forward (or off-ramp it to
`cancelled`/`rejected`/`disputed`). Route file:
`app/api/admin/escrow-cases/[id]/transition/route.ts`.

**Mobile flag:** Not consumed by the mobile app — admin-only. Buyer/seller
are told about the result via push notification, not by calling this route.

---

## POST /api/admin/escrow-cases/[id]/transition

**Auth:** `requireEscrowThreadWriteAccess(request, id)` — identical guard to
`POST .../messages` (see
[`docs/api/admin-escrow-cases-messages.md`](./admin-escrow-cases-messages.md)).
`admin`, `supervisor`, and `own` (the assigned agent) may transition the
case; the read-only `"moderation"` scope is rejected with `403` — a
moderator can view a case but never drive its lifecycle.

`toState: "agent_assigned"` is always rejected with `400`, regardless of
scope or current state — that state can only be entered via
[`POST .../assign`](./admin-escrow-cases-assign.md), which sets
`assignedAgentId` atomically with the state change. Routing it through this
endpoint would let a case reach `agent_assigned` with no agent set.

### Request

Path params:

| Param | Type   | Required | Notes                              |
|-------|--------|----------|-------------------------------------|
| `id`  | string | yes      | Escrow case id (`escrow_case.id`)  |

Body — `transitionSchema` in
`app/api/admin/escrow-cases/[id]/transition/route.ts`:

| Field     | Type   | Required | Constraint                                                        |
|-----------|--------|----------|--------------------------------------------------------------------|
| `toState` | string | yes      | One of `escrow_case_state`'s enum values (see below)              |
| `reason`  | string | no       | `.trim().max(1000)` — stored on the audit row, not on the message |

Valid `toState` values: `requested`, `agent_assigned` (always 400 here),
`verification`, `payment_pending`, `handover_scheduled`,
`handover_confirmed`, `completed`, `cancelled`, `rejected`, `disputed`. Which
of these are actually reachable from the case's *current* state is enforced
server-side by `assertValidTransition`
(`features/escrow-cases/lib/state-machine.ts`) — not by this schema, which
only checks the value is a real enum member. `cancelled`/`rejected`/`disputed`
are reachable from any non-terminal state; `completed` and the other three
off-ramps have no further outgoing transitions (`disputed` is currently
modeled as terminal — see the technical doc's "Edge cases" section).

### Response

`200 OK`:

```json
{
  "success": true,
  "case": {
    "id": "case-1",
    "buyerId": "usr_buyer",
    "sellerId": "usr_seller",
    "listingId": "prod-1",
    "assignedAgentId": "usr_agent",
    "state": "payment_pending"
  }
}
```

**Side effects**, all inside one `db.transaction` with the state write
itself (`transitionEscrowCaseState`,
`features/escrow-cases/db/case-transitions.ts`) — never as separate
top-level writes:

- Inserts one `escrow_case_message` row (`kind: "system"`,
  `systemEventType: "state_changed"`, `systemEventPayload: {from, to}`,
  English copy from `buildSystemMessageCopy`).
- Inserts one `escrow_chat_audit_log` row (`actionType: "state_changed"`,
  `beforeState`/`afterState: {state}`, `reason` if provided).

After the transaction commits, two fire-and-forget side effects (never
surfaced to the caller on failure, `.catch`-logged only):

- `broadcastCaseEvents(id, [{ event: "case_state_changed", ... }])`.
- `sendEscrowCaseStateChangeNotification(...)` — push to `[buyerId,
  sellerId]` (not the agent — they're the one driving the change).

#### Errors

| Status | Body                                              | Cause                                                                                          |
|--------|--------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| 400    | `{ "error": "Invalid input" }`                          | Body missing/malformed, or `toState` isn't a real enum value                                     |
| 400    | `{ "error": "Use assignEscrowCaseAgent to transition into \"agent_assigned\"" }` | `toState` was `"agent_assigned"`                                              |
| 401    | `{ "error": "Unauthorized" }`                           | No session                                                                                          |
| 403    | `{ "error": "Forbidden" }`                              | Caller has no case access, or scope is `"moderation"`                                              |
| 404    | `{ "error": "Not found" }`                              | No case with that `id`                                                                              |
| 409    | `{ "error": "Cannot transition escrow case from \"<from>\" to \"<to>\"" }` | The state machine rejects this specific transition from the case's current state |
| 409    | `{ "error": "Escrow case <id> was modified concurrently — reload and retry" }` | Someone else changed the case's state between this route's read and write |
| 500    | `{ "error": "Failed to update case state" }`            | Unexpected server error                                                                             |

### Example

```bash
curl -s -X POST \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"toState":"payment_pending","reason":"Buyer confirmed funds ready"}' \
  "http://localhost:3000/api/admin/escrow-cases/case-1/transition"
```

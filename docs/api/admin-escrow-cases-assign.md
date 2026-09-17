# /api/admin/escrow-cases/[id]/assign

`POST` — assign an agent to an unassigned case, or reassign an already-
assigned case to a different agent. Route file:
`app/api/admin/escrow-cases/[id]/assign/route.ts`.

**Mobile flag:** Not consumed by the mobile app — admin-only.

---

## POST /api/admin/escrow-cases/[id]/assign

**Auth:** `requireEscrowCaseAccess(request, id)`, then an extra check the
route adds on top — **only `scope === "admin"` or `scope === "supervisor"`
may proceed**; `"own"` (the case's own currently-assigned agent) and
`"moderation"` are both rejected with `403`. Unlike message-sending and
state transitions, an agent working their own case cannot hand it to
someone else — reassignment is a supervisor/admin decision.

```ts
const access = await requireEscrowCaseAccess(request, id)
if (!access.ok) return access.error
if (access.scope !== "admin" && access.scope !== "supervisor") {
  return jsonError("Only a supervisor or admin can assign or reassign a case", 403)
}
```

### Request

Path params:

| Param | Type   | Required | Notes                              |
|-------|--------|----------|--------------------------------------|
| `id`  | string | yes      | Escrow case id (`escrow_case.id`)  |

Body — `assignSchema` in `app/api/admin/escrow-cases/[id]/assign/route.ts`:

| Field     | Type   | Required | Constraint          |
|-----------|--------|----------|------------------------|
| `agentId` | string | yes      | `.trim().min(1)` — a real `user.id` |

The route looks up `agentId`'s (and, if the case already has one, the
current agent's) `user.name` itself before calling
`setEscrowCaseAgent` — the caller never supplies a name.

`setEscrowCaseAgent`
(`features/escrow-cases/db/case-transitions.ts`) decides **assign vs.
reassign** from the case's current `assignedAgentId`, not from a field in
this request:

- **First assignment** (`assignedAgentId` was `null`): if the case is
  currently `requested`, its state also advances to `agent_assigned` in the
  same write. System event `"assigned"`, audit `actionType:
  "case_assigned"`.
- **Reassignment** (`assignedAgentId` was already set to someone else): the
  case's state is left **unchanged** — this is a mid-flow handover, not a
  fresh start. System event `"reassigned"`, audit `actionType:
  "case_reassigned"`.
- Assigning the **same** agent the case already has is rejected with `400`
  (see Errors) rather than silently no-oping.

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
    "assignedAgentId": "usr_new_agent",
    "state": "agent_assigned"
  }
}
```

**Side effects**, inside the same `db.transaction` as the assignment write:
one `escrow_case_message` system row and one `escrow_chat_audit_log` row
(see above for which event/action type). After commit, fire-and-forget
(`.catch`-logged only): `broadcastCaseEvents(id, [{ event:
"case_state_changed", ... }])`. Unlike message-send and state-transition,
this route does **not** currently send a push notification on assignment/
reassignment — only on a state change.

#### Errors

| Status | Body                                                        | Cause                                                                                     |
|--------|-----------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| 400    | `{ "error": "Invalid input" }`                                    | Body missing/malformed, or `agentId` is empty                                                 |
| 400    | `{ "error": "Case is already assigned to this agent" }`           | `agentId` equals the case's current `assignedAgentId`                                        |
| 401    | `{ "error": "Unauthorized" }`                                     | No session                                                                                      |
| 403    | `{ "error": "Forbidden" }`                                        | Caller has no case access at all                                                               |
| 403    | `{ "error": "Only a supervisor or admin can assign or reassign a case" }` | Caller's scope is `"own"` or `"moderation"`                                    |
| 404    | `{ "error": "Not found" }`                                        | No case with that `id` (from `requireEscrowCaseAccess`)                                        |
| 404    | `{ "error": "Agent not found" }`                                  | `agentId` doesn't resolve to a real `user` row                                                 |
| 409    | `{ "error": "Escrow case <id> was modified concurrently — reload and retry" }` | Someone else assigned/transitioned the case between this route's read and write |
| 500    | `{ "error": "Failed to assign case" }`                            | Unexpected server error                                                                          |

### Example

```bash
curl -s -X POST \
  -H "Cookie: better-auth.session_token=<session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"usr_new_agent"}' \
  "http://localhost:3000/api/admin/escrow-cases/case-1/assign"
```

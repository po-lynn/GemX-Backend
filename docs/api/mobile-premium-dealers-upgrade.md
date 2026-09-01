# Mobile: Upgrade premium dealer package

**Endpoint:** `POST /api/mobile/premium-dealers/upgrade`  
**Auth:** `Authorization: Bearer <session_token>`  
**Mobile flag:** yes

## Request

```json
{ "targetPackageName": "Diamond Package" }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `targetPackageName` | string | Yes | Higher-tier package name from settings (max 120 chars). |

## Behavior

Upgrades an active premium dealer subscription by charging `target.pointsRequired − current.pointsRequired` only. Server resolves current package from DB — client must not send prices or current package.

## Response 200

```json
{
  "success": true,
  "previousPackageName": "Gold Package",
  "packageName": "Diamond Package",
  "pointsUsed": 10000,
  "remainingPoints": 5000,
  "startDate": "2026-01-01T00:00:00.000Z",
  "expiresAt": "2026-02-01T00:00:00.000Z",
  "autoRenew": true,
  "status": "active"
}
```

## Errors

| Status | Body |
|--------|------|
| 400 | `{ "error": "Invalid upgrade request" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 404 | `{ "error": "Package not found" }` |
| 409 | `{ "error": "No active premium dealer subscription to upgrade" }` |
| 409 | `{ "error": "Current premium dealer package is no longer available" }` |
| 409 | `{ "error": "Target package must be a higher tier than your current package" }` |
| 422 | `{ "error": "Insufficient points balance" }` |
| 500 | `{ "error": "Failed to upgrade premium dealer package" }` |

## Example

```bash
curl -X POST "https://your-host/api/mobile/premium-dealers/upgrade" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetPackageName":"Diamond Package"}'
```

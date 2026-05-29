# API: GET /api/mobile/points/balance

## Endpoint

`GET /api/mobile/points/balance`

## Auth

Session cookie (mobile bearer token or cookie auth). Returns 401 if unauthenticated.

## Request

No parameters.

## Response

**200 OK**

```json
{
  "available": 42850,
  "reserved": 0,
  "lifetime": 318400
}
```

| Field | Type | Description |
|-------|------|-------------|
| available | number | Current spendable balance (`user.points`) |
| reserved | number | Points locked for pending operations — always 0 until escrow is implemented |
| lifetime | number | Cumulative total points ever credited (`user.pointsLifetime`) |

**401 Unauthorized**

```json
{ "error": "Unauthorized" }
```

**500 Internal Server Error**

```json
{ "error": "Failed to load balance" }
```

## Example

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/mobile/points/balance
```

```json
{ "available": 42850, "reserved": 0, "lifetime": 318400 }
```

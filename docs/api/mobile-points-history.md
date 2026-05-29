# API: GET /api/mobile/points/history

## Endpoint

`GET /api/mobile/points/history`

## Auth

Session cookie. Returns 401 if unauthenticated.

## Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| filter | string | `all` | `all` \| `topups` \| `spent` \| `pending` |
| page | integer | `1` | Page number (min 1) |
| limit | integer | `20` | Results per page (1–50) |

### Filter behaviour

| Filter | Returns |
|--------|---------|
| `all` | All transactions for the user |
| `topups` | Completed credit transactions (type=topup or registration_bonus) |
| `spent` | Completed debit transactions (direction=debit) |
| `pending` | Transactions awaiting admin approval (status=pending) |

## Response

**200 OK**

```json
{
  "balance": {
    "available": 42850,
    "reserved": 0,
    "lifetime": 318400
  },
  "transactions": [
    {
      "id": "abc123",
      "type": "topup",
      "direction": "credit",
      "amount": 5000,
      "status": "completed",
      "description": "Top-up via KBZ Pay",
      "paymentMethod": "KBZ Pay",
      "referenceId": "req-uuid",
      "referenceType": "purchase_request",
      "createdAt": "2026-05-22T18:04:00.000Z"
    }
  ],
  "pagination": {
    "total": 24,
    "page": 1,
    "limit": 20
  }
}
```

### Transaction `type` values

| Type | Direction | Description |
|------|-----------|-------------|
| `topup` | credit | Point purchase via payment method |
| `registration_bonus` | credit | Signup bonus |
| `premium_activation` | debit | Premium dealer package purchase |
| `feature_activation` | debit | Product featuring spend |
| `admin_adjustment` | credit or debit | Manual admin override |

### Transaction `status` values

| Status | Meaning |
|--------|---------|
| `completed` | Points have been credited/deducted |
| `pending` | Awaiting admin approval (top-ups only) |
| `rejected` | Admin rejected the purchase request |
| `cancelled` | Cancelled before processing |

**400 Bad Request** — invalid query params

**401 Unauthorized**

**500 Internal Server Error**

## Example

```bash
# All transactions, page 1
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/mobile/points/history"

# Pending top-ups only
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/mobile/points/history?filter=pending"

# Spent, page 2
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/mobile/points/history?filter=spent&page=2&limit=10"
```

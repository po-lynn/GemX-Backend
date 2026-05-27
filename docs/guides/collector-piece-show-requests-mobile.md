# Collector piece show requests (mobile)

## List your requests

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/mobile/collector-piece-show-requests?page=1&limit=10"
```

Use **`productName`** and **`sellerName`** in the list UI so users do not need an extra product fetch to label each row.

## Submit

See **5.4.4** in `docs/MOBILE-API.md` for **POST** body and errors.

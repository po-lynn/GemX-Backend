# Guide: Check phone on signup

## Prerequisites

None beyond a running app and DB with `user.phone` populated for existing accounts.

## Use from the mobile signup form

1. User enters phone (`09…`).
2. Call:

```bash
curl -X POST http://localhost:3000/api/mobile/check-phone \
  -H "Content-Type: application/json" \
  -d '{"phone":"09123456789"}'
```

3. If `exists === true` (or `available === false`), show “This phone number is already registered.”
4. Otherwise continue to `POST /api/mobile/register`.

## Extending

To also check NRC uniqueness, add a similar public route using the same rate-limit pattern (register already returns **409** for duplicate NRC).

## Common errors

| Error | Fix |
| --- | --- |
| 400 Phone must start with 09 | Client sent a non-Myanmar format |
| 429 | Wait for `Retry-After` seconds |

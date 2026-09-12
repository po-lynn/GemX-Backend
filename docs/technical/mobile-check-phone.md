# Mobile check-phone API

## What changed

Added public **`POST /api/mobile/check-phone`** for the signup screen to detect whether a Myanmar phone is already registered before calling register.

| Path | Role |
| --- | --- |
| `app/api/mobile/check-phone/route.ts` | Route handler |
| `lib/phone.ts` → `normalizeMyanmarPhone` | Same normalization as register |
| `features/users/db/users.ts` → `getUserEmailByPhone` | Existence lookup |

## Data flow

```
Client phone (09… / +959…)
  → normalizeMyanmarPhone
  → getUserEmailByPhone(+959…)
  → { exists, available, phone }
```

## Auth & permissions

Public. Rate-limited (30 / 15 min / IP) to limit enumeration.

## Edge cases

- Invalid format → **400** (no DB hit)
- Missing body / empty phone → **400**
- Phone exists with any role → `exists: true`

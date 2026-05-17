# GemX — QA Test Plan Index

> Test cases are organised per feature in `docs/qa/`.  
> Open the file that matches what you're testing.

---

| File | Feature |
|------|---------|
| [qa/admin-ui.md](qa/admin-ui.md) | Admin panel — navigation, forms, purchase request table |
| [qa/authentication.md](qa/authentication.md) | Mobile login & registration (phone normalisation, role assignment) |
| [qa/authorization.md](qa/authorization.md) | Role guards, bearer tokens, public vs protected endpoints |
| [qa/points-purchase.md](qa/points-purchase.md) | Credit point packages, purchase requests, admin approve/reject |
| [qa/become-premium.md](qa/become-premium.md) | Become Premium screen — settings, status, activation, E2E flows |
| [qa/feature-product.md](qa/feature-product.md) | Feature a product on the homepage |
| [qa/session-errors.md](qa/session-errors.md) | Token expiry, JSON error format, malformed requests |

---

## Priority Legend

| Level | Meaning |
|-------|---------|
| **Critical** | System unusable or security breach if this fails |
| **High** | Core feature broken, direct user-facing impact |
| **Medium** | Edge case or secondary feature affected |
| **Low** | Cosmetic issue or very rare edge case |

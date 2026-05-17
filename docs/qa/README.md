# GemX — QA Test Plans

> **Project:** GemX Gemstone & Jewellery Marketplace  
> **Last updated:** 2026-05-16

Each file covers one feature area. Open the file that matches what you're testing.

---

## Feature Files

| File | Feature | Key Endpoints |
|------|---------|---------------|
| [admin-ui.md](admin-ui.md) | Admin panel navigation, forms, purchase request UI | `/admin/*` |
| [authentication.md](authentication.md) | Mobile login, registration, phone normalisation | `POST /api/mobile/login`, `POST /api/mobile/register` |
| [authorization.md](authorization.md) | Role guards, bearer tokens, public vs protected | All endpoints |
| [points-purchase.md](points-purchase.md) | Point packages, purchase requests, admin approve/reject | `GET /api/mobile/point-packages`, `POST /api/mobile/points/purchase-request`, `/api/admin/point-purchase-requests/*` |
| [become-premium.md](become-premium.md) | Become Premium screen — packages, status, activation, E2E flows | `GET /api/mobile/premium-dealers/settings`, `GET /api/mobile/premium-dealers/status`, `POST /api/mobile/premium-dealers/activate`, `GET /api/mobile/premium-dealers` |
| [feature-product.md](feature-product.md) | Feature a product on homepage | `POST /api/mobile/products/[id]/feature` |
| [session-errors.md](session-errors.md) | Token expiry, JSON errors, HTTP error format | All endpoints |

---

## Priority Legend

| Level | Meaning |
|-------|---------|
| **Critical** | System unusable or security breach if this fails |
| **High** | Core feature broken, direct user-facing impact |
| **Medium** | Edge case or secondary feature affected |
| **Low** | Cosmetic issue or very rare edge case |

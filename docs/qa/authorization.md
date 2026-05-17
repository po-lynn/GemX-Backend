# QA — Authorization & Roles

> **Feature:** Role guards, bearer token auth, public vs protected endpoints  
> **Scope:** Admin session auth, mobile bearer token auth, public endpoints

---

## 1. Admin Endpoints — Role Guard

| TC# | Test Case | Endpoint | Session | Expected Status | Expected Response | Priority |
|-----|-----------|----------|---------|-----------------|-------------------|----------|
| AUTHZ-01 | No session on admin endpoint | `GET /api/admin/point-purchase-requests` | None | 401 | `{ error: "Unauthorized" }` | Critical |
| AUTHZ-02 | User-role session on admin endpoint | `GET /api/admin/point-purchase-requests` | User cookie | 403 | `{ error: "Forbidden" }` | Critical |
| AUTHZ-03 | Admin session on admin endpoint | `GET /api/admin/point-purchase-requests` | Admin cookie | 200 | Data returned | Critical |
| AUTHZ-04 | Approve with user-role session | `POST /api/admin/point-purchase-requests/[id]/approve` | User cookie | 403 | Forbidden | Critical |
| AUTHZ-05 | Reject with user-role session | `POST /api/admin/point-purchase-requests/[id]/reject` | User cookie | 403 | Forbidden | Critical |
| AUTHZ-06 | Admin pages redirect unauthenticated users | Navigate to `/admin/credit` without login | Redirect or 401 | Login page or Unauthorized | High |

---

## 2. Mobile Endpoints — Auth Required vs Public

| TC# | Endpoint | Method | No Token | Expected Status | Notes | Priority |
|-----|----------|--------|----------|-----------------|-------|----------|
| AUTHZ-07 | `/api/mobile/points/purchase-request` | POST | No header | 401 | Auth required | Critical |
| AUTHZ-08 | `/api/mobile/points/purchase-requests` | GET | No header | 401 | Auth required | High |
| AUTHZ-09 | `/api/mobile/premium-dealers/activate` | POST | No header | 401 | Auth required | High |
| AUTHZ-10 | `/api/mobile/premium-dealers/status` | GET | No header | 401 | Auth required | High |
| AUTHZ-11 | `/api/mobile/products/[id]/feature` | POST | No header | 401 | Auth required | High |
| AUTHZ-12 | `/api/mobile/premium-dealers` | GET | No header | 200 | Public endpoint | High |
| AUTHZ-13 | `/api/mobile/point-packages` | GET | No header | 200 | Public endpoint | High |
| AUTHZ-14 | `/api/mobile/premium-dealers/settings` | GET | No header | 200 | Public endpoint | High |

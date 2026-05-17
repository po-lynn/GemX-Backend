# QA — Session & Error Handling

> **Feature:** Cross-cutting concerns — token expiry, JSON error format, HTTP error responses  
> **Scope:** All API endpoints

---

## 1. Session & Token Behaviour

| TC# | Test Case | Steps | Expected Result | Priority |
|-----|-----------|-------|-----------------|----------|
| SES-01 | Expired / invalid bearer token | Use a malformed or old token on any protected mobile endpoint | 401 Unauthorized | High |
| SES-02 | All API errors return JSON | Call any endpoint with wrong method or bad input | Response `Content-Type: application/json`, not an HTML error page | High |
| SES-03 | DB failure returns 500 JSON | Simulate DB unavailable (or disconnect) | `{ error: "..." }` JSON response with status 500 — no stack trace exposed | High |
| SES-04 | Admin session persists across navigation | Login as admin, navigate to multiple admin pages | Still logged in; no re-auth required during the session | High |

---

## 2. Request Body & Input Errors

| TC# | Test Case | Steps | Expected Result | Priority |
|-----|-----------|-------|-----------------|----------|
| ERR-01 | Malformed JSON body | Send `Content-Type: application/json` with body `{broken` | 400 — `.catch(() => ({}))` in route handler returns validation error | Medium |
| ERR-02 | Missing Content-Type header | POST without `Content-Type: application/json` | Body treated as empty `{}`, Zod validation fails with 400 | Medium |
| ERR-03 | Extra unknown fields ignored | Send valid body + `"injected":"evil"` | 200 — Zod strips unknown keys silently | Medium |
| ERR-04 | Very large body | Send a ~10 MB JSON payload | 400 or 413 — server rejects before processing | Low |
| ERR-05 | Correct HTTP method check | Call a POST-only endpoint with GET | 405 Method Not Allowed (where implemented) | Low |

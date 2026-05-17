# QA — Authentication

> **Feature:** Mobile login and registration  
> **Scope:** Phone normalisation, password validation, registration bonus, role assignment

---

## 1. Mobile Login — `POST /api/mobile/login`

**Headers:** `Content-Type: application/json`

| TC# | Test Case | Request Body | Expected Status | Expected Response | Priority |
|-----|-----------|--------------|-----------------|-------------------|----------|
| AUTH-01 | Valid phone and password | `{"phone":"09123456789","password":"pass123"}` | 200 | `{ user: {...}, session: {...}, token: "..." }` | Critical |
| AUTH-02 | Phone too short (< 9 digits after 09) | `{"phone":"091234","password":"pass123"}` | 400 | `{ error: "Phone must start with 09 and password is required" }` | High |
| AUTH-03 | Wrong password | `{"phone":"09123456789","password":"wrongpass"}` | 401 | `{ error: "Invalid phone number or password" }` | High |
| AUTH-04 | Empty phone | `{"phone":"","password":"pass123"}` | 400 | Error about phone required | High |
| AUTH-05 | Phone with spaces and dashes | `{"phone":"09-123 456 789","password":"pass123"}` | 200 | Spaces/dashes stripped, login succeeds | Medium |
| AUTH-06 | Phone starting with +95 | `{"phone":"+959123456789","password":"pass123"}` | 400 | Rejected — must start with 09 | Medium |
| AUTH-07 | Non-JSON body | Body: `hello` (plain text) | 400 | Error response (`.catch(() => ({}))` handles invalid JSON) | Medium |
| AUTH-08 | Missing password field | `{"phone":"09123456789"}` | 400 | Password required error | High |

---

## 2. Mobile Registration — `POST /api/mobile/register`

**Headers:** `Content-Type: application/json`

| TC# | Test Case | Request Body | Expected Status | Expected Response | Priority |
|-----|-----------|--------------|-----------------|-------------------|----------|
| AUTH-09 | Valid new user | `{"phone":"09999999999","password":"pass123","name":"Ko Aung"}` | 201 | User object with `role: "user"`, session token | Critical |
| AUTH-10 | Duplicate phone number | Same phone as existing user | 409 | `{ error: "This phone number is already registered" }` | High |
| AUTH-11 | Empty password | `{"phone":"09999999999","password":""}` | 400 | Password required error | High |
| AUTH-12 | Role injection attempt | Add `"role":"admin"` to body | 201 | `user.role` in response is `"user"` — admin plugin blocks role on sign-up | Critical |
| AUTH-13 | Registration bonus credited | Valid registration with bonus enabled (e.g. 200 pts) | 201 | `user.points` in DB equals configured default registration bonus | High |
| AUTH-14 | Optional fields omitted | Only `phone`, `password`, `name` provided | 201 | User created, optional fields (`nrc`, `address`, etc.) null in DB | Medium |
| AUTH-15 | Phone normalisation on register | `{"phone":"09-888 888 888",...}` | 201 | Phone stored as `+959888888888` | Medium |

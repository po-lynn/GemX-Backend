# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev           # Start Next.js dev server
npm run build         # Production build
npm run start         # Start production server

# Database
npm run db:generate   # Generate Drizzle migrations from schema changes
npm run db:migrate    # Apply pending migrations
npm run db:push       # Push schema directly (dev only)
npm run db:studio     # Open Drizzle Studio UI

# Linting
npm run lint          # ESLint

# Testing
npm run test                 # Run all tests (unit + api + integration + component)
npm run test:watch           # Watch mode
npm run test:unit            # Unit tests only (tests/unit/)
npm run test:api             # API route tests only (tests/api/)
npm run test:integration     # Integration tests only
npm run test:component       # Component tests only (jsdom)
```

> The pre-commit hook runs the full test suite. Fix failing tests before committing.

## Architecture

**GemX** is a gemstone & jewellery marketplace — a Next.js 16 App Router application with mobile API endpoints, an admin panel, and a buyer/seller web interface.

### Stack

- **Framework:** Next.js 16 + React 19 + TypeScript 5 (App Router)
- **Database:** PostgreSQL via Drizzle ORM, hosted on Supabase
- **Auth:** Better Auth (email/password, bearer tokens, admin plugin) with Drizzle adapter
- **Storage:** Supabase Storage (buckets: `product-images`, `product-videos`, `product-certificates`)
- **Styling:** Tailwind CSS v4 + shadcn/ui (New York style) + Mantine UI (rich editors)
- **Rich Text:** BlockNote editor (articles/news)
- **Testing:** Vitest + jsdom
- **Path alias:** `@/*` maps to the repository root

### Key Directories

| Path | Purpose |
|------|---------|
| `app/api/` | API routes — `mobile/` (buyer/seller app), `admin/` (staff), `products/`, `auth/[...all]/` |
| `app/admin/` | Admin panel pages |
| `features/` | Feature modules — each has `db/`, `schemas/`, `components/` subdirectories |
| `drizzle/schema/` | One file per domain (product-schema, auth-schema, etc.) |
| `drizzle/migrations/` | SQL migration files (auto-generated) |
| `lib/` | Shared utilities: `auth.ts`, `auth-client.ts`, `supabase/`, `formatters.ts`, `pagination.ts` |
| `tests/` | `unit/`, `api/`, `integration/`, `component/` |
| `docs/` | Domain docs: `MOBILE-API.md`, `TECHNICAL-PRODUCTS.md`, `TDD.md`, `REQUIREMENTS.md` |

### Feature Module Pattern

Each feature under `features/<name>/` typically contains:
- `db/` — Drizzle queries and cache helpers
- `schemas/` — Zod validation schemas
- `components/` — React components for that feature

### API Surface

- `/api/mobile/*` — Mobile app endpoints (bearer token auth)
- `/api/admin/*` — Admin endpoints (session auth)
- `/api/products`, `/api/categories`, etc. — Public endpoints
- `/api/upload/*` — Supabase file upload endpoints
- `/api/auth/[...all]` — Better Auth handler

### Environment Variables

```
DATABASE_URL=
AUTH_SECRET=
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=   # optional, for uploads
SUPABASE_SERVICE_ROLE_KEY=  # optional, for upload auth
```

Copy `.env.example` to `.env.local` for local development.

### Database Workflow

Schema changes go in `drizzle/schema/<domain>-schema.ts`, exported through `drizzle/schema.ts`. After editing schema: `npm run db:generate` then `npm run db:migrate`. SQL scripts for special cases (full-text search, supabase-specific) live in `scripts/`.

### Docs

See `docs/` for domain-specific documentation:
- `MOBILE-API.md` — Mobile/public API contract
- `TECHNICAL-PRODUCTS.md` — Product logic and algorithms
- `TDD.md` — Testing conventions
- `REQUIREMENTS.md` — Feature specifications

## After Every Change — REQUIRED

After completing any code change, generate ALL applicable outputs below **before marking the task done**. Never skip based on change size — a one-line fix can still break a collaborator's assumption.

### 1. Technical Doc → `docs/technical/<name>.md`

Document the internals for the engineering team:
- **What changed** and why (include the file paths touched)
- **Data flow** — how data moves through the feature (schema → query → route → client)
- **Schema impact** — if any Drizzle schema changed, document old vs new shape and migration generated
- **Auth & permissions** — which auth context is required (session, bearer, admin, public)
- **Edge cases & known limitations**

### 2. Unit Tests → `tests/unit/<name>.test.ts` or `tests/api/<name>.test.ts`

Write tests using Vitest. Place in the correct folder:
- `tests/unit/` — pure functions, Zod schemas, formatters, db query helpers
- `tests/api/` — API route handlers (mock auth + Drizzle)
- `tests/component/` — React components with jsdom
- `tests/integration/` — multi-layer flows

Requirements:
- Cover happy path, edge cases, and error states
- Mock Drizzle queries with `vi.mock`, mock Better Auth session/bearer as needed
- Each test has a comment explaining what behavior it validates
- Run `npm run test` and confirm all tests pass before finishing

### 3. Collaborator Guide → `docs/guides/<feature>.md`

Step-by-step for other developers to use or extend the feature:
- Prerequisites (env vars needed, dependencies to install)
- How to use the feature end-to-end with code examples
- How to extend it (add a new field, add a new endpoint, etc.)
- Common errors and how to fix them

### 4. API Docs → `docs/api/<route>.md` *(only if an API route changed)*

Required when any file under `app/api/` is created or modified:
- **Endpoint:** method + full path
- **Auth:** session cookie / bearer token / admin session / public
- **Request:** headers, path params, query params, body (include Zod schema reference)
- **Response:** success shape + all error codes with messages
- **Example:** working `curl` command + example JSON response
- **Mobile flag:** note if this is consumed by the mobile app (`/api/mobile/*`)

---

## Docs

See `docs/` for domain-specific documentation:
- `MOBILE-API.md` — Mobile/public API contract
- `TECHNICAL-PRODUCTS.md` — Product logic and algorithms
- `TDD.md` — Testing conventions
- `REQUIREMENTS.md` — Feature specifications
- `docs/technical/` — Per-change technical notes (auto-generated)
- `docs/guides/` — Collaborator step-by-step guides (auto-generated)
- `docs/api/` — Per-route API reference (auto-generated)


Before approving this PR, check the diff for:

SECURITY:
[ ] No hardcoded secrets or API keys added
[ ] New API routes have authentication middleware
[ ] Input validation present on all request body fields
[ ] No new `any` type casts that bypass validation
[ ] No sensitive data (passwords, tokens) in API responses
[ ] CORS headers not loosened without justification

QUALITY:
[ ] No unhandled async errors (missing try/catch or .catch())
[ ] No N+1 queries introduced (check for DB calls inside loops)
[ ] HTTP status codes are semantically correct
[ ] New functions have TypeScript return types
[ ] No console.log left in production code paths
[ ] Response structure matches existing API envelope pattern

If any item fails, comment with: file:line | issue | suggested fix
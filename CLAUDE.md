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

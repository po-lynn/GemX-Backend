# Test-Driven Development (TDD) Workflow

This project enforces **automated testing best practices**: the **full test suite** (unit, integration, API, and component tests) must pass before any Git commit is allowed.

## Setup (step by step)

**Step 1 — Install dependencies** (adds Vitest, Husky, lint-staged):

```bash
npm install
```

The `prepare` script runs `husky` so Git uses the `.husky/` hooks.

**Step 2 — Run the full test suite**:

```bash
npm run test
```

**Step 3 — Optional: run tests in watch mode** while coding:

```bash
npm run test:watch
```

## Pre-commit hook (step by step)

When you run `git commit`:

1. Git runs the `.husky/pre-commit` script.
2. The script runs `npm run test` (full suite: unit, integration, API, component).
3. If **all** tests pass → commit proceeds.
4. If **any** test fails → commit is **blocked** and you see the test output.

**Bypass (use sparingly):** `git commit --no-verify` or `HUSKY=0 git commit ...`

## Test layout

| Location | Purpose |
|----------|---------|
| `tests/unit/` | Unit tests (formatters, schemas, pagination, normalize) |
| `tests/integration/` | Integration tests (multi-layer flows, API + DB, auth + routes) |
| `tests/api/` | API route tests (handlers with mocked DB) |
| `tests/component/` | Component tests (React components, jsdom) |

Run a subset: `npm run test:unit`, `npm run test:integration`, `npm run test:api`, `npm run test:component`.  
Run the full suite: `npm run test` (required to pass before commit).

## What’s covered

- **Unit:** `lib/formatters`, `lib/pagination` (getPageNumbers), product search schema, `normalizeProductBody`
- **API:** GET `/api/categories`; products: GET/POST `/api/products`, GET/PATCH/DELETE `/api/products/[id]`, GET `/api/products/mine` (all with mocked auth, DB, and cache)

## Adding tests

1. Add tests in the right layer: `tests/unit/`, `tests/integration/`, `tests/api/`, or `tests/component/`.
2. Unit/API: keep tests fast; mock I/O and external deps in API tests.
3. Component: use jsdom (configured via `environmentMatchGlobs` in `vitest.config.ts`); add `@testing-library/react` when writing real component tests.
4. Config: `vitest.config.ts` (include patterns, `@` alias, node vs jsdom per folder, optional coverage).

## Best practices

- **Red–green–refactor:** Write a failing test, implement the minimum to pass, then refactor.
- **Run tests before commit:** The hook enforces this; use `test:watch` while coding.
- **Keep the suite fast:** So the pre-commit hook stays quick and reliable.

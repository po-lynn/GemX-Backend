# Documentation

This project is a **gemstone & jewellery marketplace** (GemX). Code and product behaviour are documented in a few dedicated files. **When you change behaviour, update the right doc.**

## Where to update what

| When you… | Update this file |
|-----------|------------------|
| **Add or change a unit test / test case** | [TDD.md](./TDD.md) — describe the new or updated test, where it lives, and what it covers. |
| **Change any API** (mobile, public, or admin) | [MOBILE-API.md](./MOBILE-API.md) — update the "Recent changes" section and the affected route(s), request/response shapes, and examples. |
| **Add or change logic, algorithms, or function-level behaviour** | [TECHNICAL-PRODUCTS.md](./TECHNICAL-PRODUCTS.md) — document the function, algorithm, validation rules, or domain logic (products and related features). For other domains (auth, subscriptions, reviews, etc.), add or reference the appropriate technical doc. |

## Other docs

- **[TESTING-UPLOADS.md](./TESTING-UPLOADS.md)** — How to test product-media and certificate upload APIs (browser, curl, Vitest).
- **[REQUIREMENTS.md](./REQUIREMENTS.md)** — Full feature spec: Mobile (registration, profile, buyers, sellers, subscription, homepage, ratings), Admin (users, products, reviews, subscriptions), and Additional (i18n, premium media, dual currency, deal management, chat & reports). Use it as the single source of truth for what’s planned and built.
- **[TERMINAL-SANDBOX-LINUX.md](./TERMINAL-SANDBOX-LINUX.md)** — Terminal/sandbox environment notes (e.g. Linux).

## Quick reference

- **Tests:** `docs/TDD.md`
- **API contract:** `docs/MOBILE-API.md`
- **Technical behaviour (products, logic, algorithms):** `docs/TECHNICAL-PRODUCTS.md`
- **Product/feature requirements:** `docs/REQUIREMENTS.md`

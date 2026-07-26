# Load Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build k6 load-test scripts and supporting seed/cleanup scripts to verify GemX's production infrastructure can handle 200 concurrent mobile API users (mixed login/non-login) and find the admin panel's breaking point above its expected 5 concurrent staff users, before mobile app store launch.

**Architecture:** A Node/TypeScript seed script mints tagged test accounts and products directly through Better Auth's server API and Drizzle (bypassing HTTP rate limits), writing every created ID/token to a JSON manifest. Five k6 scripts (plain JS, no build step) read that manifest and `BASE_URL` to run five load scenarios against production. A cleanup script reads the same manifest to delete every test row afterward.

**Tech Stack:** k6 (standalone binary, JS scripting), tsx (existing project convention for one-off scripts), Drizzle ORM, Better Auth server API (`auth.api.signUpEmail`/`signInEmail`), Vitest (for the one unit-testable piece).

## Global Constraints

- Every new script that imports `@/lib/auth` or `@/drizzle/db` must `import "@/data/load-env"` as its **first** import — this loads `.env`/`.env.local` before those modules read `DATABASE_URL` at module-init time (confirmed pattern from `data/seed-admin.ts`).
- k6 scripts are plain `.js`, never `.ts` — k6 does not run TypeScript natively. They read configuration only from the `BASE_URL` env var and the `tests/load/.loadtest-ids.json` manifest — never a hardcoded URL or credential.
- **Production is the only target.** Any step that runs the seed or cleanup script writes real rows to whatever `DATABASE_URL` points at. Never run these at full scale unattended — every such step in this plan is a small-count (2-3 records) dry run that requires the user's explicit go-ahead before running, and the full-scale run is a separate, later, user-initiated action (documented in the README, not something this plan executes).
- Test account role must be set via an explicit `db.update(user).set({ role })` call after `auth.api.signUpEmail` — never rely on a `role` field inside the sign-up body. The Better Auth `admin()` plugin marks `role` `input: false`, so client-supplied `role` in the sign-up body is silently ignored (confirmed in `app/api/mobile/register/route.ts`, which does the same explicit follow-up update rather than trusting the sign-up body).
- Schema cascade behavior (confirmed by reading `drizzle/schema/*.ts` directly): deleting a `user` row **cascades** to `session`, `account`, `userFavouriteProduct`, `pointPurchaseRequest`, `pointTransaction`, and `product` (via `sellerId`) — all declared `onDelete: "cascade"`. The `messages` table has **no** foreign key on `senderId`/`recipientId` (plain `text` columns) — it does **not** cascade and must be deleted explicitly.
- Chat writes must only ever target another seeded test account (`recipientId` sourced only from the manifest) — never a real user's ID.
- `POST /api/mobile/points/purchase-requests` validates `package_name`/`payment_method` against real configured settings (`getPointPurchasePackagesSettings()` / `getPaymentMethods()`) and 400s on any name that doesn't match — the seed script must read and store the first enabled real package/payment-method name, never a made-up string.
- `POST /api/mobile/login` is rate-limited to 10 requests/15min per IP; `POST /api/mobile/register` to 5/60min per IP (`lib/rate-limit.ts`). Since k6 runs from one machine (one IP), account creation and token minting must happen in-process via `auth.api.signUpEmail`/`signInEmail` (bypasses the HTTP route entirely), never by having k6 call those HTTP routes per-VU.

---

### Task 1: Load-test identifier helpers

**Files:**
- Create: `scripts/lib/load-test-identifiers.ts`
- Test: `tests/unit/load-test-identifiers.test.ts`

**Interfaces:**
- Produces: `buildBuyerPhone(n: number): string`, `buildSellerPhone(n: number): string`, `buildAdminTestEmail(n: number): string`, `LOADTEST_PASSWORD: string`, `LOADTEST_ADMIN_PASSWORD: string` — consumed by Task 2's seed script.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/load-test-identifiers.test.ts
import { describe, it, expect } from "vitest"
import {
  buildBuyerPhone,
  buildSellerPhone,
  buildAdminTestEmail,
} from "@/scripts/lib/load-test-identifiers"

describe("load-test-identifiers", () => {
  // Confirms buyer phones land in the reserved 099000xxx range so they can never collide with a real Myanmar number
  it("builds buyer phone numbers in the 099000001-099000200 range", () => {
    expect(buildBuyerPhone(1)).toBe("099000001")
    expect(buildBuyerPhone(200)).toBe("099000200")
  })

  // Confirms seller phones use a distinct reserved range from buyers
  it("builds seller phone numbers in the 099010001-099010020 range", () => {
    expect(buildSellerPhone(1)).toBe("099010001")
    expect(buildSellerPhone(20)).toBe("099010020")
  })

  // Confirms out-of-range input fails loudly instead of silently producing a colliding/wrong phone number
  it("throws for out-of-range buyer/seller indices", () => {
    expect(() => buildBuyerPhone(0)).toThrow()
    expect(() => buildBuyerPhone(201)).toThrow()
    expect(() => buildSellerPhone(0)).toThrow()
    expect(() => buildSellerPhone(21)).toThrow()
  })

  // Confirms admin test emails are clearly tagged for later identification/cleanup
  it("builds tagged admin test emails", () => {
    expect(buildAdminTestEmail(1)).toBe("loadtest-admin-1@gemx.test")
    expect(buildAdminTestEmail(20)).toBe("loadtest-admin-20@gemx.test")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/load-test-identifiers.test.ts`
Expected: FAIL — `Cannot find module '@/scripts/lib/load-test-identifiers'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/lib/load-test-identifiers.ts
/**
 * Deterministic phone/email/password generators for load-test accounts.
 * Ranges are reserved and never used by real Myanmar phone numbers.
 */

export function buildBuyerPhone(n: number): string {
  if (n < 1 || n > 200) throw new Error(`buildBuyerPhone: n must be 1-200, got ${n}`)
  return `09${9000000 + n}`
}

export function buildSellerPhone(n: number): string {
  if (n < 1 || n > 20) throw new Error(`buildSellerPhone: n must be 1-20, got ${n}`)
  return `09${9010000 + n}`
}

export function buildAdminTestEmail(n: number): string {
  if (n < 1 || n > 20) throw new Error(`buildAdminTestEmail: n must be 1-20, got ${n}`)
  return `loadtest-admin-${n}@gemx.test`
}

export const LOADTEST_PASSWORD = "LoadTest#Buyer2026!"
export const LOADTEST_ADMIN_PASSWORD = "LoadTest#Admin2026!"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/load-test-identifiers.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/load-test-identifiers.ts tests/unit/load-test-identifiers.test.ts
git commit -m "Add deterministic identifier helpers for load-test accounts"
```

---

### Task 2: Seed script

**Files:**
- Create: `scripts/lib/load-test-manifest.ts`
- Create: `scripts/seed-load-test-data.ts`
- Modify: `package.json` (add script entry)
- Modify: `.gitignore` (ignore the manifest — it contains live session tokens/passwords)

**Interfaces:**
- Consumes: `buildBuyerPhone`, `buildSellerPhone`, `buildAdminTestEmail`, `LOADTEST_PASSWORD`, `LOADTEST_ADMIN_PASSWORD` (Task 1).
- Produces: `LoadTestManifest`, `LoadTestAccount`, `LoadTestProduct` types (consumed by Task 3's cleanup script), and the on-disk file `tests/load/.loadtest-ids.json` (consumed by Tasks 4-8's k6 scripts).

- [ ] **Step 1: Write the manifest type**

```ts
// scripts/lib/load-test-manifest.ts
export interface LoadTestAccount {
  id: string
  phone?: string
  email: string
  password: string
  token?: string
}

export interface LoadTestProduct {
  id: string
  sellerId: string
  title: string
}

export interface LoadTestManifest {
  buyers: LoadTestAccount[]
  sellers: LoadTestAccount[]
  products: LoadTestProduct[]
  adminRamp: LoadTestAccount[]
  pointsPackageName: string
  paymentMethodName: string
  currency: "mmk" | "usd" | "krw"
}
```

- [ ] **Step 2: Write the seed script**

```ts
// scripts/seed-load-test-data.ts
/**
 * Creates tagged test accounts/products for load testing and writes
 * tests/load/.loadtest-ids.json so k6 scripts and the cleanup script
 * can reference exact IDs.
 *
 * SAFETY: writes real rows to whatever DATABASE_URL points at. Always
 * dry-run with small counts first:
 *   LOADTEST_BUYER_COUNT=2 LOADTEST_SELLER_COUNT=1 LOADTEST_ADMIN_COUNT=1 npx tsx scripts/seed-load-test-data.ts
 *
 * Full run: npm run seed:loadtest
 */
import "@/data/load-env"
import { writeFileSync } from "node:fs"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import { user, product } from "@/drizzle/schema"
import { getPointPurchasePackagesSettings, getPaymentMethods } from "@/features/points/db/points"
import {
  buildBuyerPhone,
  buildSellerPhone,
  buildAdminTestEmail,
  LOADTEST_PASSWORD,
  LOADTEST_ADMIN_PASSWORD,
} from "./lib/load-test-identifiers"
import type { LoadTestAccount, LoadTestManifest } from "./lib/load-test-manifest"

const BUYER_COUNT = Number(process.env.LOADTEST_BUYER_COUNT ?? 200)
const SELLER_COUNT = Number(process.env.LOADTEST_SELLER_COUNT ?? 20)
const ADMIN_COUNT = Number(process.env.LOADTEST_ADMIN_COUNT ?? 20)

async function createMobileAccount(phone: string, name: string): Promise<LoadTestAccount> {
  const email = `user_${phone.replace(/\D/g, "")}@phone.local`
  const username = phone.replace(/\D/g, "")
  const password = LOADTEST_PASSWORD

  let result = await auth.api.signUpEmail({
    body: { email, password, name, username, displayUsername: name, phone },
  } as Parameters<typeof auth.api.signUpEmail>[0])

  if (result && "error" in result) {
    // Already seeded from a prior run — sign in instead to fetch a fresh token (idempotent re-run).
    result = await auth.api.signInEmail({ body: { email, password } })
  }

  if (!result || !("user" in result) || !result.user) {
    throw new Error(`Failed to create/sign in mobile test account for ${phone}: ${JSON.stringify(result)}`)
  }

  const userId = (result.user as { id: string }).id
  await db.update(user).set({ role: "user" }).where(eq(user.id, userId))

  return { id: userId, phone, email, password, token: (result as { token: string }).token }
}

async function createAdminAccount(email: string, name: string): Promise<LoadTestAccount> {
  const username = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "")
  const password = LOADTEST_ADMIN_PASSWORD

  let result = await auth.api.signUpEmail({
    body: { email, password, name, username, displayUsername: name },
  } as Parameters<typeof auth.api.signUpEmail>[0])

  if (result && "error" in result) {
    result = await auth.api.signInEmail({ body: { email, password } })
  }

  if (!result || !("user" in result) || !result.user) {
    throw new Error(`Failed to create/sign in admin test account for ${email}: ${JSON.stringify(result)}`)
  }

  const userId = (result.user as { id: string }).id
  await db.update(user).set({ role: "admin" }).where(eq(user.id, userId))

  return { id: userId, email, password }
}

async function main() {
  console.log(`Seeding ${BUYER_COUNT} buyers, ${SELLER_COUNT} sellers, ${ADMIN_COUNT} admin-ramp accounts...`)

  const buyers: LoadTestAccount[] = []
  for (let i = 1; i <= BUYER_COUNT; i++) {
    buyers.push(await createMobileAccount(buildBuyerPhone(i), `LoadTest Buyer ${i}`))
  }

  const sellers: LoadTestAccount[] = []
  const products: LoadTestManifest["products"] = []
  for (let i = 1; i <= SELLER_COUNT; i++) {
    const seller = await createMobileAccount(buildSellerPhone(i), `LoadTest Seller ${i}`)
    sellers.push(seller)
    const [row] = await db
      .insert(product)
      .values({
        title: `[LOADTEST] Test Ruby ${i}`,
        price: "500.00",
        sellerId: seller.id,
        status: "active",
        moderationStatus: "approved",
      })
      .returning({ id: product.id })
    products.push({ id: row.id, sellerId: seller.id, title: `[LOADTEST] Test Ruby ${i}` })
  }

  const adminRamp: LoadTestAccount[] = []
  for (let i = 1; i <= ADMIN_COUNT; i++) {
    adminRamp.push(await createAdminAccount(buildAdminTestEmail(i), `LoadTest Admin ${i}`))
  }

  const settings = await getPointPurchasePackagesSettings()
  const pkg = settings.packages.find((p) => p.enabled !== false)
  if (!pkg) {
    throw new Error(
      "No enabled points package configured — cannot seed a realistic purchase-request scenario. Configure one in the admin credit settings first.",
    )
  }

  const paymentMethods = (await getPaymentMethods()).filter((m) => m.enabled !== false)
  const paymentMethod = paymentMethods[0]
  if (!paymentMethod) {
    throw new Error("No enabled payment method configured — cannot seed a realistic purchase-request scenario.")
  }

  const manifest: LoadTestManifest = {
    buyers,
    sellers,
    products,
    adminRamp,
    pointsPackageName: pkg.name,
    paymentMethodName: paymentMethod.name,
    currency: "mmk",
  }

  writeFileSync("tests/load/.loadtest-ids.json", JSON.stringify(manifest, null, 2))
  console.log(
    `Wrote tests/load/.loadtest-ids.json — ${buyers.length} buyers, ${sellers.length} sellers, ${products.length} products, ${adminRamp.length} admin-ramp accounts.`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
```

- [ ] **Step 3: Add the npm script**

Edit `package.json`, in the `"scripts"` block, add after `"seed:admin": "tsx data/seed-admin.ts",`:

```json
    "seed:loadtest": "tsx scripts/seed-load-test-data.ts",
```

- [ ] **Step 4: Ignore the manifest**

Edit `.gitignore`, add a new section:

```
# load testing — contains live session tokens/passwords, never commit
tests/load/.loadtest-ids.json
```

- [ ] **Step 5: Manual dry-run verification — requires explicit user go-ahead, do not run unattended**

This writes real rows to production. Ask the user to confirm, then run:

```bash
LOADTEST_BUYER_COUNT=2 LOADTEST_SELLER_COUNT=1 LOADTEST_ADMIN_COUNT=1 npx tsx scripts/seed-load-test-data.ts
```

Expected: console prints `Wrote tests/load/.loadtest-ids.json — 2 buyers, 1 sellers, 1 products, 1 admin-ramp accounts.` Inspect the file, confirm each entry has a non-empty `token` (buyers/sellers) or `id`/`email`/`password` (admin). Spot-check in the admin panel that `LoadTest Buyer 1` and `[LOADTEST] Test Ruby 1` exist and the product is visible (status active, moderation approved). Do not run the full-scale seed until Task 3 (cleanup) is also verified.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/load-test-manifest.ts scripts/seed-load-test-data.ts package.json .gitignore
git commit -m "Add load-test account/product seeding script"
```

---

### Task 3: Cleanup script

**Files:**
- Create: `scripts/cleanup-load-test-data.ts`
- Modify: `package.json` (add script entry)

**Interfaces:**
- Consumes: `LoadTestManifest` type (Task 2), reads `tests/load/.loadtest-ids.json` written by Task 2's seed script.

- [ ] **Step 1: Write the cleanup script**

```ts
// scripts/cleanup-load-test-data.ts
/**
 * Deletes every row created by scripts/seed-load-test-data.ts, using the
 * exact IDs recorded in tests/load/.loadtest-ids.json. Run immediately
 * after every load test.
 *
 * Deleting `user` cascades to session, account, userFavouriteProduct,
 * pointPurchaseRequest, pointTransaction, and product (via sellerId) —
 * all declared onDelete: "cascade" in the schema. `messages` has no FK
 * on senderId/recipientId, so it does NOT cascade and must be deleted
 * explicitly first.
 */
import "@/data/load-env"
import { readFileSync } from "node:fs"
import { inArray, or } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { user, messages } from "@/drizzle/schema"
import type { LoadTestManifest } from "./lib/load-test-manifest"

async function main() {
  const manifest: LoadTestManifest = JSON.parse(readFileSync("tests/load/.loadtest-ids.json", "utf-8"))

  const allUserIds = [
    ...manifest.buyers.map((a) => a.id),
    ...manifest.sellers.map((a) => a.id),
    ...manifest.adminRamp.map((a) => a.id),
  ]

  if (allUserIds.length === 0) {
    console.log("Manifest is empty — nothing to clean up.")
    return
  }

  const deletedMessages = await db
    .delete(messages)
    .where(or(inArray(messages.senderId, allUserIds), inArray(messages.recipientId, allUserIds)))
    .returning({ id: messages.id })

  const deletedUsers = await db.delete(user).where(inArray(user.id, allUserIds)).returning({ id: user.id })

  console.log(
    `Deleted ${deletedMessages.length} chat messages and ${deletedUsers.length} test accounts (cascading to sessions, favourites, purchase requests, transactions, and products).`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
```

- [ ] **Step 2: Add the npm script**

Edit `package.json`, add after the `seed:loadtest` line from Task 2:

```json
    "cleanup:loadtest": "tsx scripts/cleanup-load-test-data.ts",
```

- [ ] **Step 3: Manual verification — requires explicit user go-ahead**

Using the small dry-run manifest from Task 2 Step 5, run:

```bash
npm run cleanup:loadtest
```

Expected: `Deleted 0 chat messages and 4 test accounts (cascading to sessions, favourites, purchase requests, transactions, and products).` (0 messages since the dry run never sent a chat message). Confirm via the admin panel or a direct query that `LoadTest Buyer 1`, `LoadTest Seller 1`, `LoadTest Admin 1`, and `[LOADTEST] Test Ruby 1` are all gone. Only after this is confirmed working should the full-scale seed (Task 2's `npm run seed:loadtest`) ever be run.

- [ ] **Step 4: Commit**

```bash
git add scripts/cleanup-load-test-data.ts package.json
git commit -m "Add load-test data cleanup script"
```

---

### Task 4: Anonymous browsing scenario (`mobile-non-login.js`)

**Files:**
- Create: `tests/load/lib/config.js`
- Create: `tests/load/mobile-non-login.js`
- Create: `tests/load/results/.gitkeep`
- Modify: `.gitignore` (ignore k6 result JSON files, keep the folder)
- Modify: `eslint.config.mjs` (exclude `tests/load` — k6 scripts use globals like `__ENV`/`__VU`/`open` that ESLint doesn't know and that aren't Next.js app code)

**Interfaces:**
- Produces: `BASE_URL` (string), `thresholdsFor(kind: "read" | "write")` from `tests/load/lib/config.js` — consumed by every k6 script in Tasks 4-8.

- [ ] **Step 1: Exclude `tests/load` from ESLint**

Edit `eslint.config.mjs`, add `"tests/load/**"` to the `globalIgnores` array:

```js
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // k6 load-test scripts use k6-specific globals (__ENV, __VU, __ITER, open) —
    // not Next.js app code, not meaningful to lint with this config.
    "tests/load/**",
  ]),
```

- [ ] **Step 2: Write the shared config helper**

```js
// tests/load/lib/config.js
export const BASE_URL = __ENV.BASE_URL
if (!BASE_URL) {
  throw new Error(
    "BASE_URL env var is required, e.g. BASE_URL=https://gemx.example.com k6 run tests/load/mobile-non-login.js",
  )
}

export function thresholdsFor(kind) {
  return kind === "write"
    ? { http_req_duration: ["p(95)<1500"], http_req_failed: ["rate<0.01"] }
    : { http_req_duration: ["p(95)<800"], http_req_failed: ["rate<0.01"] }
}
```

- [ ] **Step 3: Write the non-login browsing scenario**

```js
// tests/load/mobile-non-login.js
import http from "k6/http"
import { check, sleep } from "k6"
import { BASE_URL, thresholdsFor } from "./lib/config.js"

export const options = {
  scenarios: {
    mobile_non_login: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 140 },
        { duration: "5m", target: 140 },
        { duration: "1m", target: 0 },
      ],
    },
  },
  thresholds: thresholdsFor("read"),
}

export default function () {
  const categoriesRes = http.get(`${BASE_URL}/api/categories?type=loose_stone`, {
    tags: { endpoint_type: "read" },
  })
  check(categoriesRes, { "categories 200": (r) => r.status === 200 })

  const productsRes = http.get(`${BASE_URL}/api/products?page=1&limit=20`, {
    tags: { endpoint_type: "read" },
  })
  check(productsRes, { "products 200": (r) => r.status === 200 })

  const products = productsRes.json("products")
  if (Array.isArray(products) && products.length > 0) {
    const pick = products[Math.floor(Math.random() * products.length)]
    const detailRes = http.get(`${BASE_URL}/api/products/${pick.id}`, {
      tags: { endpoint_type: "read" },
    })
    check(detailRes, { "product detail 200": (r) => r.status === 200 })
  }

  const newsRes = http.get(`${BASE_URL}/api/news?page=1&limit=10`, { tags: { endpoint_type: "read" } })
  check(newsRes, { "news 200": (r) => r.status === 200 })

  const articlesRes = http.get(`${BASE_URL}/api/articles?page=1&limit=10`, {
    tags: { endpoint_type: "read" },
  })
  check(articlesRes, { "articles 200": (r) => r.status === 200 })

  sleep(1)
}
```

- [ ] **Step 4: Create the results folder placeholder**

Create `tests/load/results/.gitkeep` (empty file) so the folder exists in git even though its contents are ignored.

- [ ] **Step 5: Ignore result files**

Edit `.gitignore`, extend the load-testing section from Task 2:

```
# load testing — contains live session tokens/passwords, never commit
tests/load/.loadtest-ids.json
tests/load/.admin-credentials.json
tests/load/results/*
!tests/load/results/.gitkeep
```

- [ ] **Step 6: Verify the script parses correctly (no network calls)**

Run: `k6 inspect tests/load/mobile-non-login.js`
Expected: prints the parsed `options` JSON (scenarios, thresholds) with no errors. This does **not** make any HTTP requests — safe to run freely. If k6 isn't installed yet, install per `tests/load/README.md` (written in Task 9) — e.g. `brew install k6` or the [official install docs](https://k6.io/docs/get-started/installation/).

- [ ] **Step 7: Commit**

```bash
git add tests/load/lib/config.js tests/load/mobile-non-login.js tests/load/results/.gitkeep .gitignore eslint.config.mjs
git commit -m "Add k6 anonymous mobile browsing load-test scenario"
```

---

### Task 5: Authenticated mobile scenario (`mobile-authenticated.js`)

**Files:**
- Create: `tests/load/mobile-authenticated.js`

**Interfaces:**
- Consumes: `BASE_URL`, `thresholdsFor` (Task 4); reads `tests/load/.loadtest-ids.json` (written by Task 2's seed script) directly via k6's `open()`.

- [ ] **Step 1: Write the authenticated scenario**

```js
// tests/load/mobile-authenticated.js
import http from "k6/http"
import { check, sleep } from "k6"
import { BASE_URL, thresholdsFor } from "./lib/config.js"

const manifest = JSON.parse(open("./.loadtest-ids.json"))

export const options = {
  scenarios: {
    mobile_authenticated: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 60 },
        { duration: "5m", target: 60 },
        { duration: "1m", target: 0 },
      ],
    },
  },
  thresholds: thresholdsFor("write"),
}

export default function () {
  const buyer = manifest.buyers[__VU % manifest.buyers.length]
  const seller = manifest.sellers[__VU % manifest.sellers.length]
  const testProduct = manifest.products.find((p) => p.sellerId === seller.id)
  const authHeader = { Authorization: `Bearer ${buyer.token}` }

  const favRes = http.get(`${BASE_URL}/api/mobile/favourite-products?page=1&limit=10`, {
    headers: authHeader,
    tags: { endpoint_type: "read" },
  })
  check(favRes, { "favourites 200": (r) => r.status === 200 })

  if (testProduct) {
    const addFavRes = http.post(
      `${BASE_URL}/api/mobile/favourite-products`,
      JSON.stringify({ productId: testProduct.id }),
      {
        headers: { ...authHeader, "Content-Type": "application/json" },
        tags: { endpoint_type: "write" },
      },
    )
    check(addFavRes, { "favourite added": (r) => r.status === 200 || r.status === 201 })

    // Recipient is always another seeded test account — never a real user.
    const chatRes = http.post(
      `${BASE_URL}/api/chat/messages`,
      JSON.stringify({ recipientId: seller.id, content: `Load test message ${__VU}-${__ITER}` }),
      {
        headers: { ...authHeader, "Content-Type": "application/json" },
        tags: { endpoint_type: "write" },
      },
    )
    check(chatRes, { "chat message sent": (r) => r.status === 200 || r.status === 201 })
  }

  if (Math.random() < 0.1) {
    const purchaseRes = http.post(
      `${BASE_URL}/api/mobile/points/purchase-requests`,
      JSON.stringify({
        package_name: manifest.pointsPackageName,
        payment_method: manifest.paymentMethodName,
        currency: manifest.currency,
        transferredAmount: 1000,
        transferredName: "Load Test",
        transactionReference: `loadtest-${__VU}-${__ITER}`,
      }),
      {
        headers: { ...authHeader, "Content-Type": "application/json" },
        tags: { endpoint_type: "write" },
      },
    )
    check(purchaseRes, { "purchase request created": (r) => r.status === 200 || r.status === 201 })
  }

  sleep(1)
}
```

- [ ] **Step 2: Verify the script parses correctly (no network calls)**

Run: `k6 inspect tests/load/mobile-authenticated.js`
Expected: parsed `options` JSON printed, no errors. (This will fail with a clear "no such file" error until `tests/load/.loadtest-ids.json` exists from a Task 2 dry run — that's expected; the real manifest only needs to exist before an actual `k6 run`, not for `k6 inspect` to report a script-syntax problem, though in practice `k6 inspect` also executes init-context code including `open()`, so run the Task 2 Step 5 dry run first if this errors on a missing file.)

- [ ] **Step 3: Commit**

```bash
git add tests/load/mobile-authenticated.js
git commit -m "Add k6 authenticated mobile load-test scenario"
```

---

### Task 6: Login endpoint spot-check (`mobile-login-endpoint.js`)

**Files:**
- Create: `tests/load/mobile-login-endpoint.js`

**Interfaces:**
- Consumes: `BASE_URL`, `thresholdsFor` (Task 4); reads `tests/load/.loadtest-ids.json` (Task 2).

- [ ] **Step 1: Write the login spot-check scenario**

```js
// tests/load/mobile-login-endpoint.js
import http from "k6/http"
import { check, sleep } from "k6"
import { BASE_URL, thresholdsFor } from "./lib/config.js"

const manifest = JSON.parse(open("./.loadtest-ids.json"))

// Login is rate-limited to 10 requests / 15 min per IP (lib/rate-limit.ts).
// This scenario stays well under that cap: 8 total iterations on 1 VU,
// spaced 2 minutes apart — a latency spot-check, not a concurrency test.
export const options = {
  scenarios: {
    mobile_login_endpoint: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 8,
      maxDuration: "20m",
    },
  },
  thresholds: thresholdsFor("write"),
}

export default function () {
  const account = manifest.buyers[__ITER % manifest.buyers.length]
  const res = http.post(
    `${BASE_URL}/api/mobile/login`,
    JSON.stringify({ phone: account.phone, password: account.password }),
    { headers: { "Content-Type": "application/json" }, tags: { endpoint_type: "write" } },
  )
  check(res, { "login 200": (r) => r.status === 200 })
  sleep(120)
}
```

- [ ] **Step 2: Verify the script parses correctly (no network calls)**

Run: `k6 inspect tests/load/mobile-login-endpoint.js`
Expected: parsed `options` JSON printed, no errors.

- [ ] **Step 3: Commit**

```bash
git add tests/load/mobile-login-endpoint.js
git commit -m "Add k6 login endpoint rate-limit-safe spot-check scenario"
```

---

### Task 7: Admin steady-state scenario (`admin-steady.js`)

**Files:**
- Create: `tests/load/admin-steady.js`
- Modify: `.gitignore` (already covers `tests/load/.admin-credentials.json` from Task 4 Step 5 — no further change needed here, this task just documents the file's format in the script comment)

**Interfaces:**
- Consumes: `BASE_URL`, `thresholdsFor` (Task 4); reads `tests/load/.loadtest-ids.json` (Task 2) and a manually-created `tests/load/.admin-credentials.json` (real admin credentials, never committed, never generated by any script).

- [ ] **Step 1: Write the admin steady-state scenario**

```js
// tests/load/admin-steady.js
import http from "k6/http"
import { check, sleep } from "k6"
import { BASE_URL, thresholdsFor } from "./lib/config.js"

// tests/load/.admin-credentials.json (git-ignored, created manually by the operator
// before running this script — never generated automatically, these are real staff logins):
// [{ "email": "real-admin1@company.com", "password": "..." }, ... 5 entries]
const admins = JSON.parse(open("./.admin-credentials.json"))
const manifest = JSON.parse(open("./.loadtest-ids.json"))

export const options = {
  scenarios: {
    admin_steady: {
      executor: "constant-vus",
      vus: admins.length,
      duration: "5m",
    },
  },
  thresholds: thresholdsFor("read"),
}

// Module-scope state persists across iterations within the same VU in k6,
// so each VU logs in once and reuses its token — not once-per-iteration.
let cachedToken = null
let cachedForEmail = null

function getToken(admin) {
  if (cachedToken && cachedForEmail === admin.email) return cachedToken
  const res = http.post(
    `${BASE_URL}/api/auth/sign-in/email`,
    JSON.stringify({ email: admin.email, password: admin.password }),
    { headers: { "Content-Type": "application/json" } },
  )
  check(res, { "admin login 200": (r) => r.status === 200 })
  cachedToken = res.json("token")
  cachedForEmail = admin.email
  return cachedToken
}

export default function () {
  const admin = admins[__VU % admins.length]
  const token = getToken(admin)
  const authHeader = { Authorization: `Bearer ${token}` }

  const listRes = http.get(`${BASE_URL}/api/admin/point-purchase-requests?status=pending&page=1&limit=20`, {
    headers: authHeader,
    tags: { endpoint_type: "read" },
  })
  check(listRes, { "purchase requests list 200": (r) => r.status === 200 })

  const requests = listRes.json("requests")
  const testUserIds = new Set([
    ...manifest.buyers.map((b) => b.id),
    ...manifest.sellers.map((s) => s.id),
  ])
  const loadtestRequest = Array.isArray(requests) ? requests.find((r) => testUserIds.has(r.userId)) : null

  if (loadtestRequest) {
    const approveRes = http.post(
      `${BASE_URL}/api/admin/point-purchase-requests/${loadtestRequest.id}/approve`,
      JSON.stringify({ adminNote: "load test approval" }),
      {
        headers: { ...authHeader, "Content-Type": "application/json" },
        tags: { endpoint_type: "write" },
      },
    )
    check(approveRes, { "approve 200": (r) => r.status === 200 })
  }

  sleep(2)
}
```

- [ ] **Step 2: Verify the script parses correctly (no network calls)**

Run: `k6 inspect tests/load/admin-steady.js`
Expected: parsed `options` JSON printed, no errors (assuming both manifest files already exist locally from earlier dry runs).

- [ ] **Step 3: Commit**

```bash
git add tests/load/admin-steady.js
git commit -m "Add k6 admin steady-state (5 VU) load-test scenario"
```

---

### Task 8: Admin ramp-to-breakpoint scenario (`admin-ramp.js`)

**Files:**
- Create: `tests/load/admin-ramp.js`

**Interfaces:**
- Consumes: `BASE_URL`, `thresholdsFor` (Task 4); reads `tests/load/.loadtest-ids.json` (Task 2, for `adminRamp` accounts) and `tests/load/.admin-credentials.json` (Task 7, real admins).

- [ ] **Step 1: Write the admin ramp scenario**

```js
// tests/load/admin-ramp.js
import http from "k6/http"
import { check, sleep } from "k6"
import { BASE_URL, thresholdsFor } from "./lib/config.js"

const realAdmins = JSON.parse(open("./.admin-credentials.json"))
const manifest = JSON.parse(open("./.loadtest-ids.json"))

// Combines the 5 real admin logins with the 20 seeded admin-ramp test accounts (25 total).
// Beyond 25 concurrent VUs, credentials repeat across VUs — this still generates real
// concurrent request/DB load, but per-account session isolation isn't independently
// tested past 25 concurrent identities. Documented, not hidden.
const admins = [...realAdmins, ...manifest.adminRamp.map((a) => ({ email: a.email, password: a.password }))]

export const options = {
  scenarios: {
    admin_ramp: {
      executor: "ramping-vus",
      startVUs: 5,
      stages: [
        { duration: "2m", target: 10 },
        { duration: "2m", target: 20 },
        { duration: "2m", target: 50 },
        { duration: "2m", target: 100 },
      ],
    },
  },
  thresholds: thresholdsFor("read"),
}

let cachedToken = null
let cachedForEmail = null

function getToken(admin) {
  if (cachedToken && cachedForEmail === admin.email) return cachedToken
  const res = http.post(
    `${BASE_URL}/api/auth/sign-in/email`,
    JSON.stringify({ email: admin.email, password: admin.password }),
    { headers: { "Content-Type": "application/json" } },
  )
  check(res, { "admin login 200": (r) => r.status === 200 })
  cachedToken = res.json("token")
  cachedForEmail = admin.email
  return cachedToken
}

export default function () {
  const admin = admins[__VU % admins.length]
  const token = getToken(admin)
  const authHeader = { Authorization: `Bearer ${token}` }

  const productsRes = http.get(`${BASE_URL}/api/products?page=1&limit=20`, {
    headers: authHeader,
    tags: { endpoint_type: "read" },
  })
  check(productsRes, { "admin products list 200": (r) => r.status === 200 })

  const listRes = http.get(`${BASE_URL}/api/admin/point-purchase-requests?status=pending&page=1&limit=20`, {
    headers: authHeader,
    tags: { endpoint_type: "read" },
  })
  check(listRes, { "purchase requests list 200": (r) => r.status === 200 })

  sleep(2)
}
```

**Note on stopping at first threshold breach:** k6 does not auto-abort a run on threshold breach unless `abortOnFail: true` is added per-threshold. This is intentionally left off here — the ramp should complete all 4 stages so the full curve is visible in the summary, and the operator reads off the VU count at which `p(95)` first exceeds 800ms or the error rate exceeds 1% from the stage-by-stage console output, rather than the test cutting itself off early. Document this in `docs/guides/load-testing.md` (Task 9).

- [ ] **Step 2: Verify the script parses correctly (no network calls)**

Run: `k6 inspect tests/load/admin-ramp.js`
Expected: parsed `options` JSON printed, no errors.

- [ ] **Step 3: Commit**

```bash
git add tests/load/admin-ramp.js
git commit -m "Add k6 admin ramp-to-breakpoint load-test scenario"
```

---

### Task 9: Documentation

**Files:**
- Create: `tests/load/README.md`
- Create: `docs/technical/load-testing.md`
- Create: `docs/guides/load-testing.md`

**Interfaces:**
- None — this task only documents Tasks 1-8's deliverables. No code changes.

- [ ] **Step 1: Write the quick-reference README**

```markdown
<!-- tests/load/README.md -->
# Load testing

Run against **production only**, off-peak hours, with an operator watching the live output.

## Setup

1. Install k6: `brew install k6` (macOS) or see https://k6.io/docs/get-started/installation/
2. Create `tests/load/.admin-credentials.json` manually (git-ignored, never generated):
   ```json
   [
     { "email": "real-admin1@company.com", "password": "..." },
     { "email": "real-admin2@company.com", "password": "..." }
   ]
   ```
   (5 entries — your real admin staff accounts.)
3. Seed test data (writes real rows to production — confirm before running):
   ```bash
   npm run seed:loadtest
   ```

## Running a scenario

Always smoke-test first (1 iteration), then scale up:

```bash
BASE_URL=https://<your-prod-domain> k6 run --vus 1 --iterations 1 tests/load/mobile-non-login.js
BASE_URL=https://<your-prod-domain> k6 run tests/load/mobile-non-login.js
BASE_URL=https://<your-prod-domain> k6 run tests/load/mobile-authenticated.js
BASE_URL=https://<your-prod-domain> k6 run tests/load/mobile-login-endpoint.js
BASE_URL=https://<your-prod-domain> k6 run tests/load/admin-steady.js
BASE_URL=https://<your-prod-domain> k6 run tests/load/admin-ramp.js
```

Save a result for later comparison:

```bash
BASE_URL=https://<your-prod-domain> k6 run --summary-export=tests/load/results/mobile-non-login-$(date +%Y%m%d-%H%M).json tests/load/mobile-non-login.js
```

## Cleanup (run after every test)

```bash
npm run cleanup:loadtest
```

Then spot-check the admin purchase-requests and chat dashboards to confirm no `[LOADTEST]` rows remain visible.
```

- [ ] **Step 2: Write the technical doc**

```markdown
<!-- docs/technical/load-testing.md -->
# Load testing — technical notes

## What was built

- `scripts/lib/load-test-identifiers.ts` — deterministic phone/email generators, unit tested (`tests/unit/load-test-identifiers.test.ts`).
- `scripts/seed-load-test-data.ts` — creates 200 buyer + 20 seller mobile test accounts and 20 admin-ramp test accounts via `auth.api.signUpEmail`/`signInEmail` called in-process (not through HTTP), plus ~20 `[LOADTEST]`-tagged products. Writes `tests/load/.loadtest-ids.json`.
- `scripts/cleanup-load-test-data.ts` — deletes everything from that manifest.
- `tests/load/*.js` — five k6 scenarios: anonymous browsing, authenticated actions, login-endpoint spot-check, admin steady state, admin ramp.

## Why accounts are seeded in-process, not via HTTP

`/api/mobile/login` (10 req/15min) and `/api/mobile/register` (5 req/60min) are rate-limited per-IP (`lib/rate-limit.ts`). k6 runs from a single machine (one IP), so creating/authenticating 220+ accounts through those routes would trip the limiter almost immediately. Calling `auth.api.signUpEmail`/`signInEmail` directly (as `data/seed-admin.ts` already does) bypasses the route-level limiter entirely, since the limiter lives inside the Next.js route handler, not the Better Auth library.

## Data flow

1. Seed script → Better Auth (`auth.api.signUpEmail`) → `user`/`account`/`session` rows + a session `token` captured immediately → Drizzle direct insert of `product` rows for seller accounts → manifest JSON on disk.
2. k6 scripts → read `BASE_URL` env var + manifest JSON → HTTP requests against production, tagged `endpoint_type: read|write` for threshold segregation.
3. Cleanup script → manifest JSON → explicit delete of `messages` (no FK, no cascade) → delete of `user` rows (cascades to session, account, userFavouriteProduct, pointPurchaseRequest, pointTransaction, and product via sellerId).

## Auth & permissions

- Mobile test accounts: `role: "user"` (matches real mobile registrations — there is no separate "seller" role; any user can own a product via `product.sellerId`).
- Admin-ramp test accounts: `role: "admin"`, set via an explicit `db.update(user)` after sign-up (the Better Auth `admin()` plugin ignores a client-supplied `role` in the sign-up body — `input: false`).
- Admin steady-state scenario uses real staff credentials, supplied by the operator in a git-ignored local file, never seeded.
- All authenticated k6 requests use `Authorization: Bearer <token>` — the same mechanism Better Auth's `bearer()` plugin already supports for every route (mobile and admin) via `auth.api.getSession({ headers })`.

## Known limitations

- `admin-ramp.js` beyond 25 concurrent VUs reuses credentials across multiple VUs (only 25 distinct admin identities exist) — still exercises real concurrent load, but doesn't test session isolation at >25 concurrent staff.
- The ramp scenario does not auto-abort on threshold breach; the operator reads the breakpoint off the per-stage console summary.
- No CI integration — these are manual, deliberate, production-only runs by design.
```

- [ ] **Step 3: Write the collaborator guide**

```markdown
<!-- docs/guides/load-testing.md -->
# Load testing guide

## Prerequisites

- k6 installed (`brew install k6` or see https://k6.io/docs/get-started/installation/)
- A `tests/load/.admin-credentials.json` file with 5 real admin logins (see `tests/load/README.md`)
- Production `DATABASE_URL`/`AUTH_SECRET` etc. available in your local `.env.local` (same vars the seed/cleanup scripts need, per `.env.example`)

## Running an end-to-end load test

1. `npm run seed:loadtest` — seeds test accounts/products, writes `tests/load/.loadtest-ids.json`.
2. Smoke-test each scenario at 1 VU / 1 iteration before scaling up (see `tests/load/README.md` for exact commands).
3. Run the full scenario, watching the live k6 output. Ctrl+C stops new iterations immediately if anything looks wrong.
4. `npm run cleanup:loadtest` immediately after.
5. Spot-check the admin dashboard to confirm no `[LOADTEST]` rows remain visible.

## Reading the ramp result

`admin-ramp.js` steps through 5→10→20→50→100 VUs, 2 minutes per step. Find the first stage in the console summary where `http_req_duration p(95)` exceeds 800ms or `http_req_failed` exceeds 1% — that VU count is your effective admin-panel headroom above the 5-user baseline.

## Adding a new scenario

1. Create `tests/load/<name>.js`, import `BASE_URL`/`thresholdsFor` from `./lib/config.js`.
2. If it needs test identities, read them from `tests/load/.loadtest-ids.json` via `open("./.loadtest-ids.json")` — never hardcode an account.
3. Tag every request with `tags: { endpoint_type: "read" | "write" }` so thresholds apply correctly.
4. `k6 inspect tests/load/<name>.js` to verify it parses before ever running it against production.
5. Document the new command in `tests/load/README.md`.

## Common errors

- **`BASE_URL env var is required`** — you forgot to prefix the `k6 run` command with `BASE_URL=https://...`.
- **`ENOENT` / "no such file" on `open("./.loadtest-ids.json")`** — run `npm run seed:loadtest` first.
- **429 on `/api/mobile/login` in `mobile-login-endpoint.js`** — you're running it more than once within the same 15-minute window, or alongside another process hitting that endpoint from the same IP. Wait 15 minutes.
- **400 "Package not found" / "Payment method not found"** on purchase-request writes — the enabled points package/payment method configured in the admin settings changed since the manifest was seeded; re-run `npm run seed:loadtest` to refresh those values.
```

- [ ] **Step 4: Commit**

```bash
git add tests/load/README.md docs/technical/load-testing.md docs/guides/load-testing.md
git commit -m "Document load testing setup, data flow, and collaborator guide"
```

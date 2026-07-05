# Product Colors Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a managed Color list (schema + seed, admin list/form pages, public `GET /api/colors`) and link products to it via a `colorId` FK with denormalized name — per the approved spec `docs/superpowers/specs/2026-07-05-product-colors-design.md`.

**Architecture:** Mirror the existing Origin feature file-for-file (`features/origin/` → `features/colors/`): Drizzle schema in `drizzle/schema/`, feature module with `db/`, `db/cache/`, `schemas/`, `permissions/`, `actions/`, `components/`, admin pages under `app/admin/colors/`, public cached GET route. Products gain `colorId` (`onDelete: "set null"`) beside the existing free-text `color` column — the same coexistence pattern as `laboratoryId` + `certLabName`. Jewellery gemstones are NOT touched.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Drizzle ORM (PostgreSQL/Supabase), Zod, Vitest (+ jsdom for component tests), Tailwind/admin CSS classes (`pd-*`, `lv-*`, `ori-*`).

## Global Constraints

- Path alias `@/*` maps to the repository root.
- The pre-commit hook runs the full test suite — all tests must pass before each commit (19 pre-existing failures in unrelated suites are known; do not add new failures).
- Copy exact styles/classes from the Origin feature (`pd-sec`, `pd-field`, `pd-btn`, `lv-*`); do not invent new CSS files. Use inline styles for the colour swatch.
- Seeded colour names/hex values must match the spec table verbatim (20 rows, listed in Task 1).
- `productJewelleryGemstone` schema and `jewelleryGemstones[]` API items are out of scope — no changes there.
- The web admin/seller product form keeps its free-text colour input (out of scope; follow-up).
- Local `npm run db:migrate` may fail with password auth errors (stale `DIRECT_URL` credential, known since Jul 2). If it fails, report it and continue — the migration file itself is the deliverable.

---

### Task 1: Color table, product.colorId column, migration + seed

**Files:**
- Create: `drizzle/schema/color-schema.ts`
- Modify: `drizzle/schema.ts` (add export line)
- Modify: `drizzle/schema/product-schema.ts` (colorId column + index on `product` table only)
- Create (generated): `drizzle/migrations/0066_*.sql` (via `npm run db:generate`, then append seed SQL)

**Interfaces:**
- Consumes: existing `laboratory` FK pattern in `product-schema.ts`.
- Produces: `color` pgTable export (`id: uuid`, `name: text unique`, `hexCode: text default ""`, `createdAt`, `updatedAt`); `product.colorId: uuid | null`. Later tasks import `{ color } from "@/drizzle/schema/color-schema"`.

- [ ] **Step 1: Create the color schema file**

`drizzle/schema/color-schema.ts`:

```ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const color = pgTable("color", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  hexCode: text("hex_code").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
```

- [ ] **Step 2: Export it from the schema barrel**

In `drizzle/schema.ts`, add after the origin export line:

```ts
export * from "./schema/color-schema"
```

- [ ] **Step 3: Add colorId to the product table**

In `drizzle/schema/product-schema.ts`:

1. Add import at top (beside the laboratory import):

```ts
import { color } from "./color-schema";
```

2. In the `product` pgTable, directly below the existing `color: text("color"),` line (~line 99), add:

```ts
    colorId: uuid("color_id").references(() => color.id, {
      onDelete: "set null",
    }),
```

3. In the same table's index array (where `index("product_laboratoryId_idx").on(table.laboratoryId)` lives, ~line 152), add:

```ts
    index("product_colorId_idx").on(table.colorId),
```

Do NOT touch `productJewelleryGemstone`.

- [ ] **Step 4: Generate the migration**

Run: `npm run db:generate`
Expected: a new file `drizzle/migrations/0066_<slug>.sql` containing `CREATE TABLE "color"`, `ALTER TABLE "product" ADD COLUMN "color_id" uuid`, the FK constraint, and `CREATE INDEX "product_colorId_idx"`.

- [ ] **Step 5: Append the seed data to the generated migration**

Append to the END of the new `drizzle/migrations/0066_*.sql` file (exact values from the spec):

```sql
--> statement-breakpoint
INSERT INTO "color" ("name", "hex_code") VALUES
('Red', '#D32F2F'),
('Pink', '#E91E63'),
('Blue', '#1565C0'),
('Green', '#2E7D32'),
('Yellow', '#F9A825'),
('Orange', '#EF6C00'),
('Purple', '#6A1B9A'),
('Violet', '#7F00FF'),
('White', '#FFFFFF'),
('Colorless', ''),
('Black', '#000000'),
('Brown', '#6D4C41'),
('Gray', '#9E9E9E'),
('Golden', '#D4AF37'),
('Multi-color', ''),
('Bi-color', ''),
('Padparadscha', '#F88379'),
('Pigeon Blood Red', '#9B111E'),
('Royal Blue', '#002366'),
('Cornflower Blue', '#6495ED')
ON CONFLICT ("name") DO NOTHING;
```

- [ ] **Step 6: Apply the migration (best-effort locally)**

Run: `npm run db:migrate`
Expected: success → table + column exist and 20 colours seeded. If it fails with `password authentication failed` (known stale local `DIRECT_URL`), do not block: note in the final report that 0066 needs `npm run db:migrate` on a machine with working credentials.

- [ ] **Step 7: Verify the project still typechecks and tests pass**

Run: `npx tsc --noEmit && npm run test`
Expected: no new failures.

- [ ] **Step 8: Commit**

```bash
git add drizzle/schema/color-schema.ts drizzle/schema.ts drizzle/schema/product-schema.ts drizzle/migrations/
git commit -m "feat: add color table with seed data and product.colorId FK"
```

---

### Task 2: Color Zod schemas + unit tests

**Files:**
- Create: `features/colors/schemas/color.ts`
- Test: `tests/unit/color-schema.test.ts`

**Interfaces:**
- Produces: `colorCreateSchema` (`{ name: string (trimmed, 1–100), hexCode: "" | "#RRGGBB" (default "") }`), `colorUpdateSchema` (partial + `colorId: uuid`), `colorDeleteSchema` (`{ colorId: uuid }`), types `ColorCreate`, `ColorUpdate`. Consumed by Task 4 actions.

- [ ] **Step 1: Write the failing tests**

`tests/unit/color-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  colorCreateSchema,
  colorUpdateSchema,
  colorDeleteSchema,
} from "@/features/colors/schemas/color"

const VALID_UUID = "a1b2c3d4-e5f6-4789-a012-345678901234"

describe("colorCreateSchema", () => {
  // Validates the happy path: a name plus a well-formed hex code parses cleanly.
  it("accepts a valid name and hex code", () => {
    const r = colorCreateSchema.safeParse({ name: "Pigeon Blood Red", hexCode: "#9B111E" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toEqual({ name: "Pigeon Blood Red", hexCode: "#9B111E" })
  })

  // Validates that hexCode is optional: omitted → defaults to "" (no swatch).
  it("defaults hexCode to empty string when omitted", () => {
    const r = colorCreateSchema.safeParse({ name: "Multi-color" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.hexCode).toBe("")
  })

  // Validates that an explicit empty hex (colour with no single swatch) is allowed.
  it("accepts an explicit empty hexCode", () => {
    const r = colorCreateSchema.safeParse({ name: "Bi-color", hexCode: "" })
    expect(r.success).toBe(true)
  })

  // Validates hex format enforcement: missing '#' or bad characters are rejected.
  it.each(["9B111E", "#9B111", "#9B111EFF", "#XYZXYZ", "red"])(
    "rejects malformed hex %s",
    (hexCode) => {
      const r = colorCreateSchema.safeParse({ name: "Red", hexCode })
      expect(r.success).toBe(false)
    }
  )

  // Validates name constraints: empty/whitespace-only names are rejected, input is trimmed.
  it("rejects empty and whitespace-only names, trims valid ones", () => {
    expect(colorCreateSchema.safeParse({ name: "" }).success).toBe(false)
    expect(colorCreateSchema.safeParse({ name: "   " }).success).toBe(false)
    const r = colorCreateSchema.safeParse({ name: "  Royal Blue  " })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.name).toBe("Royal Blue")
  })

  // Validates the 100-char cap on names.
  it("rejects names longer than 100 characters", () => {
    const r = colorCreateSchema.safeParse({ name: "x".repeat(101) })
    expect(r.success).toBe(false)
  })
})

describe("colorUpdateSchema", () => {
  // Validates that update requires a UUID id and allows partial fields.
  it("accepts a colorId with only a name change", () => {
    const r = colorUpdateSchema.safeParse({ colorId: VALID_UUID, name: "Teal" })
    expect(r.success).toBe(true)
  })

  // Validates that a malformed id is rejected.
  it("rejects a non-uuid colorId", () => {
    const r = colorUpdateSchema.safeParse({ colorId: "nope", name: "Teal" })
    expect(r.success).toBe(false)
  })
})

describe("colorDeleteSchema", () => {
  // Validates delete input: uuid required.
  it("requires a uuid colorId", () => {
    expect(colorDeleteSchema.safeParse({ colorId: VALID_UUID }).success).toBe(true)
    expect(colorDeleteSchema.safeParse({ colorId: "123" }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/color-schema.test.ts`
Expected: FAIL — cannot resolve `@/features/colors/schemas/color`.

- [ ] **Step 3: Implement the schema**

`features/colors/schemas/color.ts`:

```ts
import { z } from "zod";

const hexCodeSchema = z
  .union([
    z.literal(""),
    z.string().regex(/^#[0-9a-fA-F]{6}$/, "Hex code must look like #9B111E"),
  ])
  .default("");

export const colorCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  hexCode: hexCodeSchema,
});

export const colorUpdateSchema = colorCreateSchema.partial().extend({
  colorId: z.string().uuid(),
});

export const colorDeleteSchema = z.object({
  colorId: z.string().uuid(),
});

export type ColorCreate = z.infer<typeof colorCreateSchema>;
export type ColorUpdate = z.infer<typeof colorUpdateSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/color-schema.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add features/colors/schemas/color.ts tests/unit/color-schema.test.ts
git commit -m "feat: add color zod schemas with hex validation"
```

---

### Task 3: Color DB layer + cache helpers

**Files:**
- Create: `features/colors/db/color.ts`
- Create: `features/colors/db/cache/color.ts`

**Interfaces:**
- Consumes: `color` table from Task 1; `db` from `@/drizzle/db`; `getGlobalTag`/`getIdTag` from `@/lib/dataCache`.
- Produces: `ColorOption = { id: string; name: string; hexCode: string; createdAt: Date; updatedAt: Date }`, `ColorForEdit = ColorOption`; `getAllColors(): Promise<ColorOption[]>`, `getColorById(id): Promise<ColorForEdit | null>`, `createColorInDb({name, hexCode}): Promise<string>`, `updateColorInDb(id, {name?, hexCode?}): Promise<boolean>`, `deleteColorInDb(id): Promise<boolean>`; cached variants `getCachedColors`, `getCachedColorById`, and `revalidateColorCache(id?)`. Consumed by Tasks 4, 5, 6, 7, 9.

- [ ] **Step 1: Implement the DB module (mirrors `features/origin/db/origin.ts`)**

`features/colors/db/color.ts`:

```ts
import { db } from "@/drizzle/db";
import { color } from "@/drizzle/schema/color-schema";
import { eq } from "drizzle-orm";

export type ColorOption = {
  id: string;
  name: string;
  hexCode: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ColorForEdit = ColorOption;

export async function getAllColors(): Promise<ColorOption[]> {
  return db
    .select({
      id: color.id,
      name: color.name,
      hexCode: color.hexCode,
      createdAt: color.createdAt,
      updatedAt: color.updatedAt,
    })
    .from(color)
    .orderBy(color.name);
}

export async function getColorById(id: string): Promise<ColorForEdit | null> {
  const row = await db
    .select({
      id: color.id,
      name: color.name,
      hexCode: color.hexCode,
      createdAt: color.createdAt,
      updatedAt: color.updatedAt,
    })
    .from(color)
    .where(eq(color.id, id))
    .limit(1);
  return row[0] ?? null;
}

export async function createColorInDb(input: {
  name: string;
  hexCode: string;
}): Promise<string> {
  const [inserted] = await db
    .insert(color)
    .values({ name: input.name, hexCode: input.hexCode })
    .returning({ id: color.id });
  return inserted!.id;
}

export async function updateColorInDb(
  id: string,
  input: { name?: string; hexCode?: string }
): Promise<boolean> {
  const updates = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined)
  );
  if (Object.keys(updates).length === 0) return true;
  await db.update(color).set(updates).where(eq(color.id, id));
  return true;
}

export async function deleteColorInDb(id: string): Promise<boolean> {
  const deleted = await db
    .delete(color)
    .where(eq(color.id, id))
    .returning({ id: color.id });
  return deleted.length > 0;
}
```

- [ ] **Step 2: Implement the cache module (mirrors `features/origin/db/cache/origin.ts`)**

`features/colors/db/cache/color.ts`:

```ts
import { cacheTag, updateTag } from "next/cache";
import { getGlobalTag, getIdTag } from "@/lib/dataCache";
import { getAllColors, getColorById } from "../color";
import type { ColorOption, ColorForEdit } from "../color";

function getColorGlobalTag() {
  return getGlobalTag("color");
}

function getColorIdTag(id: string) {
  return getIdTag("color", id);
}

export async function getCachedColors(): Promise<ColorOption[]> {
  "use cache";
  cacheTag(getColorGlobalTag());
  return getAllColors();
}

export async function getCachedColorById(
  id: string
): Promise<ColorForEdit | null> {
  "use cache";
  cacheTag(getColorGlobalTag(), getColorIdTag(id));
  return getColorById(id);
}

export function revalidateColorCache(id?: string) {
  updateTag(getColorGlobalTag());
  if (id) updateTag(getColorIdTag(id));
}
```

Note: `getGlobalTag`/`getIdTag` in `@/lib/dataCache` take a tag-family string — check the file first; if its first parameter is a typed union of table names, add `"color"` to that union.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add features/colors/db/
git commit -m "feat: add color db queries and cache helpers"
```

---

### Task 4: RBAC key, permissions, server actions (+ action unit tests)

**Files:**
- Modify: `features/rbac/feature-keys.ts`
- Create: `features/colors/permissions/color.ts`
- Create: `features/colors/actions/color.ts`
- Test: `tests/unit/color-actions.test.ts`

**Interfaces:**
- Consumes: Task 2 schemas; Task 3 db + cache functions; `emptyToNull`, `zodErrorMessage` from `@/lib/form-data`; `requireActionRole` from `@/lib/action-guard`.
- Produces: `FEATURE_KEYS.COLOR = "color"`; `canAdminManageColor(role: string): boolean`; server actions `createColorAction(formData)`, `updateColorAction(formData)`, `deleteColorAction(formData)`, each returning `{ success: true, colorId? } | { error: string }`. Consumed by Task 7 form and Task 8 sidebar.

- [ ] **Step 1: Add the RBAC feature key**

In `features/rbac/feature-keys.ts`:

1. In `FEATURE_KEYS`, after `LABORATORY:                "laboratory",` add:

```ts
  COLOR:                     "color",
```

2. In `FEATURE_GROUPS`, in the "Marketplace" group after the Laboratory entry, add:

```ts
      { key: FEATURE_KEYS.COLOR,              label: "Color" },
```

- [ ] **Step 2: Create the permission helper**

`features/colors/permissions/color.ts` (mirrors origin — actions are admin-only):

```ts
export function canAdminManageColor(role: string) {
  return role === "admin";
}
```

- [ ] **Step 3: Write the failing action tests**

`tests/unit/color-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  createColorAction,
  updateColorAction,
  deleteColorAction,
} from "@/features/colors/actions/color"
import { requireActionRole } from "@/lib/action-guard"
import {
  createColorInDb,
  updateColorInDb,
  deleteColorInDb,
} from "@/features/colors/db/color"
import { revalidateColorCache } from "@/features/colors/db/cache/color"

const VALID_UUID = "a1b2c3d4-e5f6-4789-a012-345678901234"

vi.mock("@/lib/action-guard", () => ({ requireActionRole: vi.fn() }))
vi.mock("@/features/colors/db/color", () => ({
  createColorInDb: vi.fn(),
  updateColorInDb: vi.fn(),
  deleteColorInDb: vi.fn(),
}))
vi.mock("@/features/colors/db/cache/color", () => ({
  revalidateColorCache: vi.fn(),
}))

function fd(entries: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireActionRole).mockResolvedValue({ user: { id: "admin-1" } } as never)
})

describe("createColorAction", () => {
  // Validates the happy path: valid input + admin session → row created, cache revalidated.
  it("creates a colour and revalidates the cache", async () => {
    vi.mocked(createColorInDb).mockResolvedValue("new-id")
    const result = await createColorAction(fd({ name: "Teal", hexCode: "#008080" }))
    expect(result).toEqual({ success: true, colorId: "new-id" })
    expect(createColorInDb).toHaveBeenCalledWith({ name: "Teal", hexCode: "#008080" })
    expect(revalidateColorCache).toHaveBeenCalled()
  })

  // Validates input rejection: a bad hex never reaches the DB.
  it("returns an error for a malformed hex code", async () => {
    const result = await createColorAction(fd({ name: "Teal", hexCode: "008080" }))
    expect(result).toHaveProperty("error")
    expect(createColorInDb).not.toHaveBeenCalled()
  })

  // Validates auth: no admin session → Unauthorized, nothing written.
  it("returns Unauthorized when the session check fails", async () => {
    vi.mocked(requireActionRole).mockResolvedValue(null as never)
    const result = await createColorAction(fd({ name: "Teal", hexCode: "" }))
    expect(result).toEqual({ error: "Unauthorized" })
    expect(createColorInDb).not.toHaveBeenCalled()
  })

  // Validates the duplicate-name path: a Postgres 23505 unique violation is
  // mapped to a friendly message instead of crashing the action.
  it("maps a unique violation to a friendly error", async () => {
    vi.mocked(createColorInDb).mockRejectedValue(
      Object.assign(new Error("duplicate key"), { code: "23505" })
    )
    const result = await createColorAction(fd({ name: "Red", hexCode: "" }))
    expect(result).toEqual({ error: "A colour with this name already exists" })
  })
})

describe("updateColorAction", () => {
  // Validates the happy path for updates.
  it("updates a colour and revalidates the cache", async () => {
    vi.mocked(updateColorInDb).mockResolvedValue(true)
    const result = await updateColorAction(
      fd({ colorId: VALID_UUID, name: "Sky Blue", hexCode: "#87CEEB" })
    )
    expect(result).toEqual({ success: true, colorId: VALID_UUID })
    expect(updateColorInDb).toHaveBeenCalledWith(VALID_UUID, {
      name: "Sky Blue",
      hexCode: "#87CEEB",
    })
  })

  // Validates the duplicate-name path on rename.
  it("maps a unique violation on rename to a friendly error", async () => {
    vi.mocked(updateColorInDb).mockRejectedValue(
      Object.assign(new Error("duplicate key"), { code: "23505" })
    )
    const result = await updateColorAction(fd({ colorId: VALID_UUID, name: "Red" }))
    expect(result).toEqual({ error: "A colour with this name already exists" })
  })
})

describe("deleteColorAction", () => {
  // Validates the happy path: existing row deleted.
  it("deletes a colour", async () => {
    vi.mocked(deleteColorInDb).mockResolvedValue(true)
    const result = await deleteColorAction(fd({ colorId: VALID_UUID }))
    expect(result).toEqual({ success: true })
  })

  // Validates the not-found path: delete of a missing row reports an error.
  it("returns an error when the colour does not exist", async () => {
    vi.mocked(deleteColorInDb).mockResolvedValue(false)
    const result = await deleteColorAction(fd({ colorId: VALID_UUID }))
    expect(result).toEqual({ error: "Color not found" })
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run tests/unit/color-actions.test.ts`
Expected: FAIL — cannot resolve `@/features/colors/actions/color`.

- [ ] **Step 5: Implement the actions (mirrors `features/origin/actions/origin.ts` + unique-violation mapping)**

`features/colors/actions/color.ts`:

```ts
"use server";

import { revalidateColorCache } from "@/features/colors/db/cache/color";
import { canAdminManageColor } from "@/features/colors/permissions/color";
import {
  colorCreateSchema,
  colorUpdateSchema,
  colorDeleteSchema,
} from "@/features/colors/schemas/color";
import {
  createColorInDb,
  updateColorInDb,
  deleteColorInDb,
} from "@/features/colors/db/color";
import { emptyToNull, zodErrorMessage } from "@/lib/form-data";
import { requireActionRole } from "@/lib/action-guard";

const DUPLICATE_NAME_ERROR = "A colour with this name already exists";

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: string; cause?: { code?: string } };
  return e.code === "23505" || e.cause?.code === "23505";
}

export async function createColorAction(formData: FormData) {
  const parsed = colorCreateSchema.safeParse({
    name: emptyToNull(formData.get("name")),
    hexCode: (formData.get("hexCode") as string | null) ?? "",
  });
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) };
  }
  const session = await requireActionRole(canAdminManageColor);
  if (!session) {
    return { error: "Unauthorized" };
  }
  try {
    const colorId = await createColorInDb({
      name: parsed.data.name,
      hexCode: parsed.data.hexCode,
    });
    revalidateColorCache();
    return { success: true, colorId };
  } catch (error) {
    if (isUniqueViolation(error)) return { error: DUPLICATE_NAME_ERROR };
    throw error;
  }
}

export async function updateColorAction(formData: FormData) {
  const parsed = colorUpdateSchema.safeParse({
    colorId: formData.get("colorId"),
    name: emptyToNull(formData.get("name")),
    hexCode: (formData.get("hexCode") as string | null) ?? "",
  });
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) };
  }
  const session = await requireActionRole(canAdminManageColor);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const { colorId, ...data } = parsed.data;
  try {
    await updateColorInDb(colorId, data);
    revalidateColorCache(colorId);
    return { success: true, colorId };
  } catch (error) {
    if (isUniqueViolation(error)) return { error: DUPLICATE_NAME_ERROR };
    throw error;
  }
}

export async function deleteColorAction(formData: FormData) {
  const parsed = colorDeleteSchema.safeParse({
    colorId: formData.get("colorId"),
  });
  if (!parsed.success) return { error: "Invalid input" };
  const session = await requireActionRole(canAdminManageColor);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const deleted = await deleteColorInDb(parsed.data.colorId);
  if (!deleted) return { error: "Color not found" };
  revalidateColorCache(parsed.data.colorId);
  return { success: true };
}
```

Note on the update test expectation: `colorUpdateSchema` is `.partial()`, so a missing `name` stays `undefined`; `hexCode` defaults to `""` because the form always submits it. `updateColorInDb` filters `undefined` values.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/color-actions.test.ts tests/unit/color-schema.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add features/rbac/feature-keys.ts features/colors/permissions/ features/colors/actions/ tests/unit/color-actions.test.ts
git commit -m "feat: add color RBAC key, permissions, and server actions"
```

---

### Task 5: Public GET /api/colors route + API test

**Files:**
- Create: `app/api/colors/route.ts`
- Test: `tests/api/colors.test.ts`

**Interfaces:**
- Consumes: `getAllColors` (Task 3), `jsonCached`/`jsonError` from `@/lib/api`.
- Produces: `GET /api/colors` → 200 `[{ id, name, hexCode }]` (name-ordered, public cache headers) | 500 `{ error: "Failed to fetch colors" }`.

- [ ] **Step 1: Write the failing test (mirrors `tests/api/categories.test.ts`)**

`tests/api/colors.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { connection } from "next/server"
import { getAllColors } from "@/features/colors/db/color"
import { GET } from "@/app/api/colors/route"

vi.mock("next/server", () => ({
  connection: vi.fn(),
}))
vi.mock("@/features/colors/db/color", () => ({
  getAllColors: vi.fn(),
}))

describe("GET /api/colors", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(getAllColors).mockResolvedValue([])
  })

  // Validates the happy path: rows come back as {id, name, hexCode} only —
  // timestamps are stripped from the public payload.
  it("returns 200 with id, name and hexCode per colour", async () => {
    vi.mocked(getAllColors).mockResolvedValue([
      { id: "c1", name: "Blue", hexCode: "#1565C0", createdAt: new Date(), updatedAt: new Date() },
      { id: "c2", name: "Multi-color", hexCode: "", createdAt: new Date(), updatedAt: new Date() },
    ] as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([
      { id: "c1", name: "Blue", hexCode: "#1565C0" },
      { id: "c2", name: "Multi-color", hexCode: "" },
    ])
  })

  // Validates the empty state: no colours → empty array, still 200.
  it("returns an empty array when no colours exist", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  // Validates the error state: db failure → 500 with the standard error envelope.
  it("returns 500 when the db throws", async () => {
    vi.mocked(getAllColors).mockRejectedValue(new Error("DB error"))
    const res = await GET()
    expect(res.status).toBe(500)
    expect(await res.json()).toHaveProperty("error", "Failed to fetch colors")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/colors.test.ts`
Expected: FAIL — cannot resolve `@/app/api/colors/route`.

- [ ] **Step 3: Implement the route (mirrors `app/api/origins/route.ts`)**

`app/api/colors/route.ts`:

```ts
import { connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getAllColors } from "@/features/colors/db/color"

export async function GET() {
  await connection()
  try {
    const colors = await getAllColors()
    return jsonCached(
      colors.map(({ id, name, hexCode }) => ({ id, name, hexCode }))
    )
  } catch (error) {
    console.error("GET /api/colors:", error)
    return jsonError("Failed to fetch colors", 500)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/colors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/colors/route.ts tests/api/colors.test.ts
git commit -m "feat: add public GET /api/colors endpoint"
```

---

### Task 6: ColorListView component + admin list page

**Files:**
- Create: `features/colors/components/ColorListView.tsx`
- Create: `app/admin/colors/page.tsx`
- Create: `app/admin/colors/loading.tsx`
- Test: `tests/component/color-list-view.test.tsx`

**Interfaces:**
- Consumes: `ColorOption` + `getAllColors` (Task 3), `FEATURE_KEYS.COLOR` (Task 4), `ListViewCard`/`ColumnDef`/`ViewTab` from `@/components/admin/list-view`, `requireFeatureAccess` from `@/lib/admin-guard`, `FadeUp` from `@/components/admin/motion`, `SkBlock`/`SkRow` from `@/components/admin/motion/skeleton`.
- Produces: `ColorListView({ colors, views, activeView })`; page route `/admin/colors`. `ColorSwatch({ hex, size? })` is exported for reuse by Task 7's form.

- [ ] **Step 1: Implement the list view (simplified from `OriginListView` — no filters, no grouping)**

`features/colors/components/ColorListView.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { ListViewCard } from "@/components/admin/list-view"
import type { ColumnDef, ViewTab } from "@/components/admin/list-view"
import type { ColorOption } from "@/features/colors/db/color"

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtRelative(d: Date): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60)     return "just now"
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return fmtDate(d)
}

/** Round swatch dot; dashed outline when the colour has no hex (Multi-color etc.). */
export function ColorSwatch({ hex, size = 18 }: { hex: string; size?: number }) {
  if (!hex) {
    return (
      <span
        title="No swatch"
        style={{
          width: size, height: size, borderRadius: size / 2.6, display: "inline-block",
          flexShrink: 0, border: "1.5px dashed rgba(100,110,130,0.5)",
          background:
            "linear-gradient(135deg, rgba(100,110,130,0.12) 25%, transparent 25%, transparent 50%, rgba(100,110,130,0.12) 50%, rgba(100,110,130,0.12) 75%, transparent 75%)",
          backgroundSize: "6px 6px",
        }}
      />
    )
  }
  return (
    <span
      style={{
        width: size, height: size, borderRadius: size / 2.6, display: "inline-block",
        flexShrink: 0, background: hex, border: "1px solid rgba(15,23,42,0.12)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)",
      }}
    />
  )
}

type Props = {
  colors: ColorOption[]
  views: ViewTab[]
  activeView: string
}

const BASE = "/admin/colors"

export function ColorListView({ colors, views, activeView }: Props) {
  const router = useRouter()

  const columnDefs: ColumnDef<ColorOption>[] = [
    {
      id: "name",
      label: "Color",
      flex: true,
      sortable: true,
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <ColorSwatch hex={r.hexCode} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--lv-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.name}
          </span>
        </div>
      ),
    },
    {
      id: "hexCode",
      label: "Hex",
      width: 120,
      sortable: true,
      render: (r) => (
        <span style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: r.hexCode ? "var(--lv-text-2)" : "var(--lv-text-3)" }}>
          {r.hexCode || "—"}
        </span>
      ),
    },
    {
      id: "updatedAt",
      label: "Updated",
      width: 150,
      sortable: true,
      render: (r) => (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
          <span style={{ fontSize: 12.5, color: "var(--lv-text)", fontVariantNumeric: "tabular-nums" }}>
            {fmtDate(r.updatedAt)}
          </span>
          <span style={{ fontSize: 10.5, color: "var(--lv-text-3)" }}>
            {fmtRelative(r.updatedAt)}
          </span>
        </div>
      ),
    },
  ]

  return (
    <ListViewCard
      rows={colors}
      columnDefs={columnDefs}
      views={views}
      activeView={activeView}
      buildViewHref={() => BASE}
      filterDefs={[]}
      groupOptions={[]}
      getGroupKey={() => null}
      filterRow={() => null}
      defaultSort={{ id: "name", dir: "asc" }}
      getSortValue={(r, colId) => {
        switch (colId) {
          case "name":      return r.name.toLowerCase()
          case "hexCode":   return r.hexCode
          case "updatedAt": return r.updatedAt.getTime()
          default:          return ""
        }
      }}
      onRowClick={(r) => router.push(`/admin/colors/${r.id}/edit`)}
      buildPageHref={(pg) => `${BASE}?page=${pg}`}
      emptyMessage="No colours found. Add a new colour to get started."
    />
  )
}
```

If `tsc` complains that `filterDefs`, `groupOptions`, `getGroupKey`, or `filterRow` are required with different shapes, match `OriginListView`'s usage exactly (it passes all four).

- [ ] **Step 2: Write the list-view component test**

`tests/component/color-list-view.test.tsx` (mocks `ListViewCard` with a thin table renderer so the test exercises OUR column definitions, not the shared list machinery):

```tsx
import { afterEach, describe, it, expect, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { ColorListView } from "@/features/colors/components/ColorListView"
import type { ColorOption } from "@/features/colors/db/color"

afterEach(cleanup)

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

type MockListViewProps = {
  rows: ColorOption[]
  columnDefs: Array<{ id: string; render: (r: ColorOption) => React.ReactNode }>
}

vi.mock("@/components/admin/list-view", () => ({
  ListViewCard: ({ rows, columnDefs }: MockListViewProps) => (
    <table>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            {columnDefs.map((c) => (
              <td key={c.id}>{c.render(r)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}))

const colors: ColorOption[] = [
  { id: "c1", name: "Royal Blue", hexCode: "#002366", createdAt: new Date("2026-07-01"), updatedAt: new Date("2026-07-05") },
  { id: "c2", name: "Multi-color", hexCode: "", createdAt: new Date("2026-07-01"), updatedAt: new Date("2026-07-05") },
]

describe("ColorListView", () => {
  // Validates that each colour row renders its name and hex code text.
  it("renders colour names and hex codes", () => {
    render(<ColorListView colors={colors} views={[{ id: "all", label: "All", count: 2 }]} activeView="all" />)
    expect(screen.getByText("Royal Blue")).toBeInTheDocument()
    expect(screen.getByText("#002366")).toBeInTheDocument()
    expect(screen.getByText("Multi-color")).toBeInTheDocument()
    expect(screen.getByText("—")).toBeInTheDocument() // empty hex placeholder
  })

  // Validates the no-swatch fallback: a colour without hex renders the dashed
  // placeholder swatch (identified by its title) instead of a coloured dot.
  it("renders a placeholder swatch when hexCode is empty", () => {
    render(<ColorListView colors={colors} views={[{ id: "all", label: "All", count: 2 }]} activeView="all" />)
    expect(screen.getByTitle("No swatch")).toBeInTheDocument()
  })
})
```

Run: `npx vitest run tests/component/color-list-view.test.tsx`
Expected: PASS (Step 1's component already exists; if you wrote this test first it fails on the missing import — either order is fine as long as both end green).

- [ ] **Step 3: Create the list page (mirrors `app/admin/origin/page.tsx`, single view)**

`app/admin/colors/page.tsx`:

```tsx
import Link from "next/link"
import { connection } from "next/server"
import { ChevronRight, Plus } from "lucide-react"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getAllColors } from "@/features/colors/db/color"
import { ColorListView } from "@/features/colors/components/ColorListView"
import type { ViewTab } from "@/components/admin/list-view"
import { FadeUp } from "@/components/admin/motion"

export default async function AdminColorsPage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.COLOR)

  const colors = await getAllColors()

  const views: ViewTab[] = [
    { id: "all", label: "All", count: colors.length },
  ]

  return (
    <FadeUp>
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <span className="lv-here">Color</span>
          </nav>
          <h1 className="lv-h1">
            Color
            <span className="lv-h1-count">{colors.length} total</span>
          </h1>
          <p className="lv-subhead">
            Product colours for gemstones, loose stones, and jewellery — shown as pickers in the apps.
          </p>
        </div>
        <div className="lv-pagehead-actions">
          <Link href="/admin/colors/new" className="lv-new-btn">
            <Plus /> New colour
          </Link>
        </div>
      </div>

      <ColorListView colors={colors} views={views} activeView="all" />
    </div>
    </FadeUp>
  )
}
```

- [ ] **Step 4: Create the loading skeleton (copy of origin's with a pink accent)**

`app/admin/colors/loading.tsx`:

```tsx
import { SkBlock, SkRow } from "@/components/admin/motion/skeleton"

export default function ColorsLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <SkBlock w={120} h={22} color="#ec4899" opacity={0.18} rounded="md" />
        <SkBlock w={200} h={11} color="#ec4899" opacity={0.10} rounded="sm" />
      </div>
      <div className="flex items-center gap-2">
        <SkBlock w={220} h={36} color="#ec4899" opacity={0.10} rounded="lg" />
        <SkBlock w={88}  h={36} color="#ec4899" opacity={0.10} rounded="lg" />
        <div className="ml-auto">
          <SkBlock w={110} h={36} color="#ec4899" opacity={0.12} rounded="lg" />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-border/60">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b border-border/40 last:border-b-0">
            <SkRow accentColor="#ec4899" cols={4} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Typecheck and run existing tests**

Run: `npx tsc --noEmit && npm run test`
Expected: clean / no new failures.

- [ ] **Step 6: Commit**

```bash
git add features/colors/components/ app/admin/colors/ tests/component/color-list-view.test.tsx
git commit -m "feat: add color admin list view and page"
```

---

### Task 7: ColorForm component, new/edit pages + component tests

**Files:**
- Create: `features/colors/components/ColorForm.tsx`
- Create: `features/colors/components/index.ts` (barrel)
- Create: `app/admin/colors/new/page.tsx`
- Create: `app/admin/colors/new/loading.tsx`
- Create: `app/admin/colors/[id]/edit/page.tsx`
- Create: `app/admin/colors/[id]/edit/loading.tsx`
- Test: `tests/component/color-form.test.tsx`

**Interfaces:**
- Consumes: actions from Task 4 (`createColorAction`, `updateColorAction`, `deleteColorAction`), `ColorForEdit` from Task 3, `getCachedColorById` from Task 3, `ColorSwatch` from Task 6, `requireFeatureAccess`, `FEATURE_KEYS.COLOR`, `FadeUp`.
- Produces: `ColorForm({ mode: "create" | "edit", color?: ColorForEdit | null })`; routes `/admin/colors/new` and `/admin/colors/[id]/edit`.

- [ ] **Step 1: Write the failing component tests**

`tests/component/color-form.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { ColorForm } from "@/features/colors/components/ColorForm"
import {
  createColorAction,
  updateColorAction,
  deleteColorAction,
} from "@/features/colors/actions/color"

afterEach(cleanup)

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock("@/features/colors/actions/color", () => ({
  createColorAction: vi.fn(),
  updateColorAction: vi.fn(),
  deleteColorAction: vi.fn(),
}))

const editColor = {
  id: "a1b2c3d4-e5f6-4789-a012-345678901234",
  name: "Royal Blue",
  hexCode: "#002366",
  createdAt: new Date("2026-07-01"),
  updatedAt: new Date("2026-07-05"),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ColorForm (create)", () => {
  // Validates client-side guard: submitting without a name shows an error and
  // never calls the server action.
  it("blocks submit when the name is empty", async () => {
    render(<ColorForm mode="create" />)
    fireEvent.click(screen.getByRole("button", { name: /create colour/i }))
    expect(await screen.findByText(/please enter a colour name/i)).toBeInTheDocument()
    expect(createColorAction).not.toHaveBeenCalled()
  })

  // Validates the happy path: name + hex are sent to the action as FormData,
  // then the form navigates back to the list.
  it("submits name and hex, then navigates to the list", async () => {
    vi.mocked(createColorAction).mockResolvedValue({ success: true, colorId: "new-id" })
    render(<ColorForm mode="create" />)
    fireEvent.change(screen.getByLabelText(/colour name/i), { target: { value: "Teal" } })
    fireEvent.change(screen.getByLabelText(/hex code/i), { target: { value: "#008080" } })
    fireEvent.click(screen.getByRole("button", { name: /create colour/i }))
    await waitFor(() => expect(createColorAction).toHaveBeenCalledTimes(1))
    const fd = vi.mocked(createColorAction).mock.calls[0]![0] as FormData
    expect(fd.get("name")).toBe("Teal")
    expect(fd.get("hexCode")).toBe("#008080")
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/colors"))
  })

  // Validates server-error surfacing: an action error renders in the form.
  it("shows the action error message on failure", async () => {
    vi.mocked(createColorAction).mockResolvedValue({ error: "A colour with this name already exists" })
    render(<ColorForm mode="create" />)
    fireEvent.change(screen.getByLabelText(/colour name/i), { target: { value: "Red" } })
    fireEvent.click(screen.getByRole("button", { name: /create colour/i }))
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})

describe("ColorForm (edit)", () => {
  // Validates pre-fill: edit mode shows the existing name and hex.
  it("pre-fills name and hex from the colour", () => {
    render(<ColorForm mode="edit" color={editColor} />)
    expect(screen.getByLabelText(/colour name/i)).toHaveValue("Royal Blue")
    expect(screen.getByLabelText(/hex code/i)).toHaveValue("#002366")
  })

  // Validates update path: submitting sends colorId along with the fields.
  it("submits the colorId on update", async () => {
    vi.mocked(updateColorAction).mockResolvedValue({ success: true, colorId: editColor.id })
    render(<ColorForm mode="edit" color={editColor} />)
    fireEvent.change(screen.getByLabelText(/colour name/i), { target: { value: "Navy" } })
    fireEvent.click(screen.getByRole("button", { name: /update colour/i }))
    await waitFor(() => expect(updateColorAction).toHaveBeenCalledTimes(1))
    const fd = vi.mocked(updateColorAction).mock.calls[0]![0] as FormData
    expect(fd.get("colorId")).toBe(editColor.id)
    expect(fd.get("name")).toBe("Navy")
  })

  // Validates delete flow: confirm step required, then the action fires and
  // the form navigates back to the list.
  it("deletes after confirmation", async () => {
    vi.mocked(deleteColorAction).mockResolvedValue({ success: true })
    render(<ColorForm mode="edit" color={editColor} />)
    fireEvent.click(screen.getByRole("button", { name: /delete permanently/i }))
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }))
    await waitFor(() => expect(deleteColorAction).toHaveBeenCalledTimes(1))
    const fd = vi.mocked(deleteColorAction).mock.calls[0]![0] as FormData
    expect(fd.get("colorId")).toBe(editColor.id)
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/colors"))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/component/color-form.test.tsx`
Expected: FAIL — cannot resolve `ColorForm`.

- [ ] **Step 3: Implement the form (structure mirrors `OriginForm`, one section)**

`features/colors/components/ColorForm.tsx`:

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createColorAction,
  updateColorAction,
  deleteColorAction,
} from "@/features/colors/actions/color"
import type { ColorForEdit } from "@/features/colors/db/color"
import { ColorSwatch } from "./ColorListView"

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtRelative(d: Date | null | undefined) {
  if (!d) return "—"
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60)     return "just now"
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return fmtDate(d)
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type Props = {
  mode: "create" | "edit"
  color?: ColorForEdit | null
}

export function ColorForm({ mode, color }: Props) {
  const router = useRouter()
  const isEdit = mode === "edit"

  const [name, setName] = useState(color?.name ?? "")
  const [hexCode, setHexCode] = useState(color?.hexCode ?? "")
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function mark() { setDirty(true) }

  const hexValid = hexCode === "" || HEX_RE.test(hexCode)

  async function handleSave(e?: React.SyntheticEvent) {
    e?.preventDefault()
    if (!name.trim()) { setError("Please enter a colour name."); return }
    if (!hexValid) { setError("Hex code must look like #9B111E, or be left empty."); return }
    setError(null)
    setLoading(true)
    const fd = new FormData()
    if (isEdit && color) fd.set("colorId", color.id)
    fd.set("name", name.trim())
    fd.set("hexCode", hexCode)
    const result = isEdit
      ? await updateColorAction(fd)
      : await createColorAction(fd)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    toast.success(isEdit ? "Colour updated" : "Colour created")
    setDirty(false)
    router.push("/admin/colors")
  }

  async function handleDelete() {
    if (!color) return
    setDeleting(true)
    const fd = new FormData()
    fd.set("colorId", color.id)
    const result = await deleteColorAction(fd)
    if (result?.error) { toast.error(result.error); setDeleting(false); return }
    toast.success("Colour deleted")
    router.push("/admin/colors")
  }

  const displayName = name || (isEdit ? color?.name : "") || "New colour"

  const detailsSection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="blue">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r=".5" /><circle cx="17.5" cy="10.5" r=".5" />
            <circle cx="8.5" cy="7.5" r=".5" /><circle cx="6.5" cy="12.5" r=".5" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Colour details</div>
          <div className="pd-sec-sub">Name shown in pickers; hex renders the swatch</div>
        </div>
      </div>
      <div className="pd-sec-body">
        <div className="pd-field" style={{ maxWidth: 360 }}>
          <label className="pd-label" htmlFor="clr-name">
            Colour name <span style={{ color: "#DC2626" }}>*</span>
            <span className="pd-label-hint">e.g. Pigeon Blood Red</span>
          </label>
          <input
            id="clr-name"
            className="pd-input"
            value={name}
            onChange={(e) => { setName(e.target.value); mark() }}
            maxLength={100}
            required
            placeholder="e.g. Royal Blue"
          />
        </div>
        <div className="pd-field" style={{ maxWidth: 360, marginTop: 14 }}>
          <label className="pd-label" htmlFor="clr-hex">
            Hex code
            <span className="pd-label-hint">optional — leave empty for Multi-color / Bi-color</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              id="clr-hex"
              className="pd-input"
              value={hexCode}
              onChange={(e) => { setHexCode(e.target.value.trim()); mark() }}
              maxLength={7}
              placeholder="#9B111E"
              style={{ fontFamily: "ui-monospace, monospace", flex: 1 }}
            />
            <input
              type="color"
              aria-label="Pick colour"
              value={HEX_RE.test(hexCode) ? hexCode : "#888888"}
              onChange={(e) => { setHexCode(e.target.value.toUpperCase()); mark() }}
              style={{ width: 36, height: 36, padding: 2, border: "1px solid rgba(15,23,42,0.15)", borderRadius: 8, cursor: "pointer", background: "transparent" }}
            />
            <ColorSwatch hex={hexValid ? hexCode : ""} size={24} />
            {hexCode !== "" && (
              <button
                type="button"
                className="pd-btn"
                onClick={() => { setHexCode(""); mark() }}
              >
                No swatch
              </button>
            )}
          </div>
          {!hexValid && (
            <span style={{ fontSize: 11.5, color: "#B91C1C", marginTop: 4, display: "block" }}>
              Must look like #9B111E
            </span>
          )}
        </div>
      </div>
    </section>
  )

  const errorBanner = error ? (
    <div style={{ background: "#FEF2F2", border: "1px solid rgba(185,28,28,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#B91C1C" }}>
      {error}
    </div>
  ) : null

  const saveIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
    </svg>
  )

  if (isEdit && color) {
    return (
      <div>
        <div className="pd-topbar">
          <div className="pd-breadcrumbs">
            <Link href="/admin/colors">Color</Link>
            <ChevronRight />
            <span className="pd-here">{displayName}</span>
          </div>
        </div>

        <div className="pd-savebar" style={{ top: 0 }}>
          {dirty
            ? <span className="pd-savebar-dirty"><span className="pd-savebar-dirty-dot" /> Unsaved changes</span>
            : <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>Saved · {fmtRelative(color.updatedAt)}</span>
          }
          <span style={{ flex: 1 }} />
          <Link href="/admin/colors" className="pd-btn">Cancel</Link>
          <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={loading || !name.trim() || !hexValid}>
            {saveIcon}
            {loading ? "Saving…" : "Update colour"}
          </button>
        </div>

        {errorBanner}

        <div className="pd-grid">
          <div className="pd-main">
            {detailsSection}
          </div>

          <div className="pd-side">
            <div className="pd-sidecard">
              <div className="pd-sidecard-head">
                <div className="pd-sidecard-icon">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                  </svg>
                </div>
                <div>
                  <div className="pd-sidecard-title">Status</div>
                  <div className="pd-sidecard-sub">Lifecycle &amp; audit</div>
                </div>
              </div>
              <div className="pd-sidecard-body">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Swatch</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <ColorSwatch hex={hexValid ? hexCode : color.hexCode} size={16} />
                      <span style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: "var(--lv-text-2)" }}>
                        {(hexValid ? hexCode : color.hexCode) || "none"}
                      </span>
                    </span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Created</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>{fmtDate(color.createdAt)}</span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Updated</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>{fmtRelative(color.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pd-sidecard">
              <div className="pd-sidecard-head">
                <div className="pd-sidecard-icon" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                </div>
                <div>
                  <div className="pd-sidecard-title">Danger zone</div>
                  <div className="pd-sidecard-sub">Irreversible actions</div>
                </div>
              </div>
              <div className="pd-sidecard-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {!showDeleteConfirm ? (
                  <button
                    className="pd-btn"
                    style={{ color: "#B91C1C", borderColor: "rgba(185,28,28,0.25)", justifyContent: "center" }}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                    Delete permanently
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <p style={{ fontSize: 12, color: "var(--lv-text-2)", lineHeight: 1.5, margin: 0 }}>
                      Delete <strong>{color.name}</strong>? Products using this colour keep their colour text; only the link is cleared.
                    </p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="pd-btn"
                        style={{ background: "#B91C1C", color: "#fff", borderColor: "transparent", flex: 1, justifyContent: "center" }}
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting ? "Deleting…" : "Confirm delete"}
                      </button>
                      <button className="pd-btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                    </div>
                  </div>
                )}
                <span style={{ fontSize: 11, color: "var(--lv-text-3)", lineHeight: 1.45 }}>
                  Deletion is permanent and cannot be undone.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="pd-topbar">
        <div className="pd-breadcrumbs">
          <Link href="/admin/colors">Color</Link>
          <ChevronRight />
          <span className="pd-here">New colour</span>
        </div>
      </div>

      <div className="pd-savebar" style={{ top: 0 }}>
        <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>New colour</span>
        <span style={{ flex: 1 }} />
        <Link href="/admin/colors" className="pd-btn">Discard</Link>
        <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={loading}>
          {saveIcon}
          {loading ? "Creating…" : "Create colour"}
        </button>
      </div>

      {errorBanner}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {detailsSection}
      </div>
    </div>
  )
}
```

Note: the create-mode save button is NOT disabled on empty name (unlike origin) so the "blocks submit when the name is empty" test can exercise the inline error path. This is intentional.

- [ ] **Step 4: Create the barrel**

`features/colors/components/index.ts`:

```ts
export { ColorForm } from "./ColorForm";
```

- [ ] **Step 5: Create the new/edit pages + loaders (mirror origin's)**

`app/admin/colors/new/page.tsx`:

```tsx
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ColorForm } from "@/features/colors/components";
import { FadeUp } from "@/components/admin/motion";

export default async function AdminColorNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.COLOR)
  return <FadeUp><ColorForm key="create" mode="create" /></FadeUp>;
}
```

`app/admin/colors/new/loading.tsx` — copy `app/admin/origin/new/loading.tsx` verbatim, replacing the accent colour value with `#ec4899` if one appears.

`app/admin/colors/[id]/edit/page.tsx`:

```tsx
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ColorForm } from "@/features/colors/components";
import { getCachedColorById } from "@/features/colors/db/cache/color";
import { requireFeatureAccess } from "@/lib/admin-guard";
import { FEATURE_KEYS } from "@/features/rbac/feature-keys";
import { FadeUp } from "@/components/admin/motion";

type Props = {
  params: Promise<{ id: string }>;
};

async function AdminColorEditContent({ params }: Props) {
  await connection();
  await requireFeatureAccess(FEATURE_KEYS.COLOR);
  const { id } = await params;
  const color = await getCachedColorById(id);
  if (!color) notFound();

  return <ColorForm key={color.id} mode="edit" color={color} />;
}

export default function AdminColorEditPage(props: Props) {
  return (
    <FadeUp>
      <Suspense
        fallback={
          <div className="animate-pulse space-y-5 py-2">
            <div className="h-8 w-48 rounded-lg bg-slate-200" />
            <div className="h-64 rounded-xl bg-white ring-1 ring-slate-200/60" />
          </div>
        }
      >
        <AdminColorEditContent {...props} />
      </Suspense>
    </FadeUp>
  );
}
```

`app/admin/colors/[id]/edit/loading.tsx` — copy `app/admin/origin/[id]/edit/loading.tsx` verbatim (swap accent colour to `#ec4899` if present).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/component/color-form.test.tsx && npx tsc --noEmit`
Expected: PASS / clean.

- [ ] **Step 7: Commit**

```bash
git add features/colors/components/ app/admin/colors/ tests/component/color-form.test.tsx
git commit -m "feat: add color form with swatch picker and admin new/edit pages"
```

---

### Task 8: Sidebar Configuration entry + test update

**Files:**
- Modify: `components/admin/AdminSidebar.tsx`
- Modify: `tests/component/admin-sidebar-configuration.test.tsx`

**Interfaces:**
- Consumes: `FEATURE_KEYS.COLOR` (Task 4); the existing `NavSubMenu` Configuration children array.
- Produces: sidebar link Color → `/admin/colors`.

- [ ] **Step 1: Update the failing test first**

In `tests/component/admin-sidebar-configuration.test.tsx`:

1. In the test `"expands to show all Configuration links, then collapses"`, after the Origin assertion add:

```ts
    expect(screen.getByRole("link", { name: "Color" })).toHaveAttribute("href", "/admin/colors")
```

2. Add a new test alongside the existing single-permission test:

```ts
  // Validates RBAC scoping for the new Color entry: a non-admin holding only
  // the color feature key sees Configuration with just the Color link.
  it("shows only Color for a non-admin with just the color permission", () => {
    render(
      <AdminSidebar
        role="internal"
        permissions={{ [FEATURE_KEYS.COLOR]: true }}
      />
    )
    fireEvent.click(configToggle())
    expect(screen.getByRole("link", { name: "Color" })).toHaveAttribute("href", "/admin/colors")
    expect(screen.queryByRole("link", { name: "Origin" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Category" })).not.toBeInTheDocument()
    fireEvent.click(configToggle()) // reset module-level store for later tests
  })
```

Follow the file's existing convention: any test that expands the sub-menu collapses it again before finishing (module-level store carries across tests).

- [ ] **Step 2: Run tests to verify the new assertions fail**

Run: `npx vitest run tests/component/admin-sidebar-configuration.test.tsx`
Expected: FAIL — no "Color" link rendered.

- [ ] **Step 3: Add the sidebar entry**

In `components/admin/AdminSidebar.tsx`:

1. Add `Palette` to the lucide-react import list.
2. In the Configuration `children` array, after the Origin entry, add:

```ts
          { href: "/admin/colors",     label: "Color",       icon: Palette,      color: "#ec4899", featureKey: FEATURE_KEYS.COLOR },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/component/admin-sidebar-configuration.test.tsx`
Expected: PASS (all, including pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add components/admin/AdminSidebar.tsx tests/component/admin-sidebar-configuration.test.tsx
git commit -m "feat: add Color link to admin Configuration sub-menu"
```

---

### Task 9: Product colorId integration (Zod, routes, DB layer) + API tests

**Files:**
- Modify: `features/products/schemas/products.ts` (add `colorId` field; relax loose-stone colour rule)
- Modify: `app/api/products/route.ts` (POST: resolve colorId → name)
- Modify: `app/api/products/[id]/route.ts` (PATCH: resolve colorId → name)
- Modify: `features/products/db/products.ts` (types, insert, update, selects)
- Test: `tests/api/products/color-link.test.ts`

**Interfaces:**
- Consumes: `getColorById` from `@/features/colors/db/color` (Task 3); `product.colorId` column (Task 1).
- Produces: product create/update accept optional `colorId: string (uuid) | null`; product rows/detail expose `colorId: string | null`.

- [ ] **Step 1: Write the failing API tests**

`tests/api/products/color-link.test.ts` (mock scaffolding copied from `tests/api/products/route.test.ts`, plus a mock for the colours db):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { POST } from "@/app/api/products/route"
import { createProductInDb } from "@/features/products/db/products"
import { deductUserPoints, getUserPointBalance } from "@/features/points/db/points"
import { getColorById } from "@/features/colors/db/color"
import { auth } from "@/lib/auth"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession: vi.fn() },
  },
}))
vi.mock("@/features/products/db/cache/products", () => ({
  getAdminProducts: vi.fn(),
  revalidateProductsCache: vi.fn(),
}))
vi.mock("@/features/products/db/products", () => ({
  createProductInDb: vi.fn(),
  getAdminProductsFromDb: vi.fn(),
}))
vi.mock("@/features/points/db/points", () => ({
  deductUserPoints: vi.fn(),
  getUserPointBalance: vi.fn(),
}))
vi.mock("@/features/colors/db/color", () => ({
  getColorById: vi.fn(),
}))

const VALID_CATEGORY_ID = "00000000-0000-4000-8000-000000000001"
const COLOR_UUID = "b2c3d4e5-f6a7-4890-b123-456789012345"

/** Minimal valid loose_stone body (mirrors route.test.ts). */
const baseBody = {
  title: "Ruby",
  price: "100",
  productType: "loose_stone" as const,
  categoryId: VALID_CATEGORY_ID,
  weightCarat: "1",
  color: "red",
  origin: "Myanmar",
}

function postReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/products with colorId", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as never)
    vi.mocked(getUserPointBalance).mockResolvedValue({
      available: 10_000,
      reserved: 0,
      lifetime: 10_000,
    })
    vi.mocked(deductUserPoints).mockResolvedValue({
      success: true,
      remainingPoints: 9_500,
    })
  })
  // Validates the resolve-and-denormalize path: a known colorId stores both
  // the id and the colour's name in the text column.
  it("resolves colorId and denormalizes the name into color", async () => {
    vi.mocked(getColorById).mockResolvedValue({
      id: COLOR_UUID, name: "Royal Blue", hexCode: "#002366",
      createdAt: new Date(), updatedAt: new Date(),
    })
    vi.mocked(createProductInDb).mockResolvedValue("p1")
    const res = await POST(postReq({ ...baseBody, colorId: COLOR_UUID }) as NextRequest)
    expect(res.status).toBe(201)
    expect(createProductInDb).toHaveBeenCalledWith(
      expect.objectContaining({ colorId: COLOR_UUID, color: "Royal Blue" })
    )
  })

  // Validates rejection of an unknown id: 400, nothing persisted.
  it("returns 400 for an unknown colorId", async () => {
    vi.mocked(getColorById).mockResolvedValue(null)
    const res = await POST(postReq({ ...baseBody, colorId: COLOR_UUID }) as NextRequest)
    expect(res.status).toBe(400)
    expect(await res.json()).toHaveProperty("error", "Unknown colorId")
    expect(createProductInDb).not.toHaveBeenCalled()
  })

  // Validates format rejection: a non-uuid colorId fails Zod validation with 400.
  it("returns 400 for a malformed colorId", async () => {
    const res = await POST(postReq({ ...baseBody, colorId: "not-a-uuid" }) as NextRequest)
    expect(res.status).toBe(400)
    expect(getColorById).not.toHaveBeenCalled()
  })

  // Validates back-compat: a plain color string with no colorId is stored as-is.
  it("still accepts a plain color string without colorId", async () => {
    vi.mocked(createProductInDb).mockResolvedValue("p1")
    const res = await POST(postReq({ ...baseBody, color: "Ocean Blue" }) as NextRequest)
    expect(res.status).toBe(201)
    expect(createProductInDb).toHaveBeenCalledWith(
      expect.objectContaining({ color: "Ocean Blue" })
    )
    expect(getColorById).not.toHaveBeenCalled()
  })

  // Validates the relaxed loose-stone rule: colorId alone satisfies the
  // "color is required for loose stone" constraint.
  it("accepts a loose stone with colorId and no color string", async () => {
    vi.mocked(getColorById).mockResolvedValue({
      id: COLOR_UUID, name: "Red", hexCode: "#D32F2F",
      createdAt: new Date(), updatedAt: new Date(),
    })
    vi.mocked(createProductInDb).mockResolvedValue("p1")
    const body = { ...baseBody, productType: "loose_stone", colorId: COLOR_UUID }
    delete (body as Record<string, unknown>).color
    const res = await POST(postReq(body) as NextRequest)
    expect(res.status).toBe(201)
    expect(createProductInDb).toHaveBeenCalledWith(
      expect.objectContaining({ color: "Red" })
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/api/products/color-link.test.ts`
Expected: FAIL — `colorId` stripped by Zod (unknown key) / `createProductInDb` not called with colorId.

- [ ] **Step 3: Add colorId to the product Zod schema**

In `features/products/schemas/products.ts`:

1. In the create base schema, directly after the `laboratoryId` field (~line 150), add:

```ts
  colorId: z
    .string()
    .uuid("colorId must be a valid UUID")
    .optional()
    .nullable(),
```

2. In the loose-stone `superRefine`, change the colour check (~line 209) from:

```ts
      if (!data.color?.trim()) {
```

to:

```ts
      if (!data.color?.trim() && !data.colorId) {
```

3. Check `productUpdateSchema` in the same file: if it derives from the base schema (e.g. `.partial()`), `colorId` is inherited — no change. If it lists fields explicitly, add the same `colorId` field there.

- [ ] **Step 4: Resolve colorId in the POST route**

In `app/api/products/route.ts`:

1. Add import: `import { getColorById } from "@/features/colors/db/color"`.
2. In `POST`, after the `parsed.success` check and before `featuredPoints` is computed, add:

```ts
    let resolvedColor = parsed.data.color
    if (parsed.data.colorId) {
      const colorRow = await getColorById(parsed.data.colorId)
      if (!colorRow) {
        return jsonError("Unknown colorId", 400)
      }
      resolvedColor = colorRow.name
    }
```

3. In `createInput`, spread the override after `...parsed.data`:

```ts
    const createInput = {
      ...parsed.data,
      color: resolvedColor,
      sellerId: session.user.id,
      jewelleryGemstones: Array.isArray(parsed.data.jewelleryGemstones)
        ? parsed.data.jewelleryGemstones
        : [],
    }
```

- [ ] **Step 5: Resolve colorId in the PATCH route**

In `app/api/products/[id]/route.ts`:

1. Add import: `import { getColorById } from "@/features/colors/db/color"`.
2. After the `productUpdateSchema.safeParse` success check (~line 143), add the same resolution block as POST (using the route's error-response helper — match how it already returns 400s):

```ts
    let resolvedColor = parsed.data.color
    if (parsed.data.colorId) {
      const colorRow = await getColorById(parsed.data.colorId)
      if (!colorRow) {
        return jsonError("Unknown colorId", 400)
      }
      resolvedColor = colorRow.name
    }
```

3. In the update payload passed to `updateProductInDb` (where `laboratoryId: data.laboratoryId` appears, ~line 191), add beside it:

```ts
        colorId: data.colorId,
        color: parsed.data.colorId ? resolvedColor : data.color,
```

(Preserve the file's local naming — if the payload is built from a variable named `data`, thread `resolvedColor` accordingly: when `colorId` was provided, the denormalized name wins; otherwise pass through whatever `color` the client sent, including `undefined` for "no change".)

- [ ] **Step 6: Thread colorId through the products DB layer**

In `features/products/db/products.ts`, add `colorId` beside every `laboratoryId` occurrence:

1. Row/response types (~lines 118, 604): add `colorId: string | null` next to `laboratoryId: string | null`.
2. List-options types (~lines 141, 400, 944): NOT needed — colour list filtering is out of scope; skip the search-option types (they take `laboratoryId` as a filter; do not add a colour filter).
3. Create-input type + insert values (~line 835): add to the input type `colorId?: string | null` and to the `.values({...})` object:

```ts
    colorId: input.colorId ?? null,
```

4. Update mapping (~line 1028): beside `if (rest.laboratoryId !== undefined) ...` add:

```ts
  if (rest.colorId !== undefined) updates.colorId = rest.colorId
```

5. Select maps returning `laboratoryId: product.laboratoryId` (~lines 271, 509, 652): add:

```ts
      colorId: product.colorId,
```

6. Row-mapping functions returning `laboratoryId: p.laboratoryId` / `row.laboratoryId` (~lines 317, 555, 766): add the matching `colorId: p.colorId` / `colorId: row.colorId`.

Use `grep -n "laboratoryId" features/products/db/products.ts` to enumerate every spot; the rule is: mirror `laboratoryId` everywhere EXCEPT the search/filter options.

- [ ] **Step 7: Run the new tests, then the whole suite**

Run: `npx vitest run tests/api/products/color-link.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit && npm run test`
Expected: no new failures (the pre-existing 19 unrelated failures may remain).

- [ ] **Step 8: Commit**

```bash
git add features/products/schemas/products.ts app/api/products/ features/products/db/products.ts tests/api/products/color-link.test.ts
git commit -m "feat: accept colorId on product create/update with denormalized color name"
```

---

### Task 10: Documentation (MOBILE-API, api/guide/technical docs) + final verification

**Files:**
- Modify: `docs/MOBILE-API.md`
- Create: `docs/api/colors.md`
- Create: `docs/technical/product-colors.md`
- Create: `docs/guides/product-colors.md`

**Interfaces:**
- Consumes: everything above. No code changes in this task.

- [ ] **Step 1: Update MOBILE-API.md**

Two edits:

1. Add a **Colors** section near the origins/categories reference sections:

```markdown
### GET /api/colors

Public, no auth. Returns the managed colour list for product colour pickers
(gemstones, loose stones, jewellery), ordered by name.

Response `200`:

​```json
[
  { "id": "<uuid>", "name": "Blue", "hexCode": "#1565C0" },
  { "id": "<uuid>", "name": "Multi-color", "hexCode": "" }
]
​```

`hexCode` is `""` when the colour has no single swatch (Multi-color,
Bi-color, Colorless) — render a placeholder instead of a swatch.
```

2. In the product create/update body documentation (sections around **5.5** / the field table near line 3087), document the new field:

```markdown
- `colorId` (uuid, optional) – a colour id from `GET /api/colors`. When
  provided, the server stores the link and writes the colour's name into
  `color` automatically (you may omit `color`). An unknown `colorId` returns
  `400 {"error": "Unknown colorId"}`. Plain `color` strings are still
  accepted. For loose stones, either `colorId` or `color` satisfies the
  "color is required" rule. `colorId` is NOT accepted on
  `jewelleryGemstones[]` items — those keep free-text `color`.
```

Also note in the changelog area at the top of the file (matching its existing changelog-entry style) that product responses now include `colorId`.

- [ ] **Step 2: Write docs/api/colors.md**

Cover, following the format of existing files in `docs/api/`:
- **Endpoint:** `GET /api/colors`
- **Auth:** public
- **Request:** no params
- **Response:** `200` → `[{ id, name, hexCode }]`; `500` → `{ error: "Failed to fetch colors" }`; cache headers `public, s-maxage=60, stale-while-revalidate=300`
- **Example:** `curl https://<host>/api/colors` + example JSON
- **Mobile flag:** consumed by the mobile app for colour pickers
- Note admin mutations happen via server actions (`features/colors/actions/color.ts`), not REST.

- [ ] **Step 3: Write docs/technical/product-colors.md**

Cover per the CLAUDE.md template:
- **What changed:** list every file from Tasks 1–9 with one-line purpose.
- **Data flow:** admin form → server action → `createColorInDb` → `revalidateColorCache`; mobile → `GET /api/colors` (cached) → picker → product POST with `colorId` → `getColorById` resolve → denormalized `color` name + `colorId` stored.
- **Schema impact:** new `color` table (shape + seed list); `product.color_id` uuid FK `ON DELETE SET NULL` + `product_colorId_idx`; migration `0066_*`; note if local migrate failed and deployment needs `npm run db:migrate` with working `DIRECT_URL`.
- **Auth & permissions:** list page/actions RBAC (`FEATURE_KEYS.COLOR` for pages, admin-only actions), public GET.
- **Edge cases & known limitations:** renaming a colour does not rewrite existing products' denormalized `color` text; deleting a colour nulls `colorId` but keeps the text; duplicate names rejected (23505 → friendly error); jewellery gemstones intentionally unlinked; admin/seller web product form still free-text (follow-up).

- [ ] **Step 4: Write docs/guides/product-colors.md**

Cover:
- Prerequisites: migration 0066 applied; no new env vars.
- How to manage colours end-to-end (admin sidebar → Configuration → Color; add/edit/delete with screenshots-in-words).
- How to consume: fetch `GET /api/colors`, send `colorId` on product create/update (example request body).
- How to extend: add a field to the colour (schema → `db:generate` → db module → zod → form → list view), add colour filtering to products (pointer to `adminProductsSearchSchema` + `getAdminProductsFromDb`).
- Common errors: `400 Unknown colorId` (stale picker cache — refetch), duplicate-name error on create, migration not applied (`relation "color" does not exist`).

- [ ] **Step 5: Final verification**

Run: `npm run lint && npx tsc --noEmit && npm run test`
Expected: lint clean, types clean, no new test failures. Also verify the full flow compiles in dev if the environment allows: `npm run dev`, visit `/admin/colors` (requires working DB creds; skip gracefully if unavailable and say so in the report).

- [ ] **Step 6: Commit**

```bash
git add docs/MOBILE-API.md docs/api/colors.md docs/technical/product-colors.md docs/guides/product-colors.md
git commit -m "docs: add product colors API, technical, and guide documentation"
```

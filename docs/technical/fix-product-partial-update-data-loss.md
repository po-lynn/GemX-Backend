# Fix: PATCH /api/products/:id wiped images/videos and reset currency on status-only updates

**Date:** 2026-07-11

## What changed

- `features/products/schemas/products.ts` — `productUpdateSchema` now overrides
  `currency`, `imageUrls`, and `videoUrls` after `.partial()` so omitted fields stay
  `undefined` instead of being defaulted/transformed to a concrete value.
- `tests/unit/product-update-schema-partial.test.ts` — new regression test.

## Root cause

`productUpdateSchema = productCreateBaseSchema.partial().extend({...})`. `.partial()`
only makes each key optional in the *type* — it does not stop a field's own
`.default()` or `.transform()` from running when the key is absent from the input:

- `currency: currencySchema.default("USD")` — omitted `currency` resolves to `"USD"`.
- `imageUrls`/`videoUrls`: `z.string().optional().transform((s) => s ? [...] : [])` —
  omitted value (`undefined`) still hits the transform, which returns `[]`.

So `PATCH /api/products/[id]` ([app/api/products/[id]/route.ts:129](../../app/api/products/[id]/route.ts)) parsing
a mobile status-only payload like `{ "status": "sold" }` produced
`parsed.data = { status: "sold", currency: "USD", imageUrls: [], videoUrls: [] }` —
all defined values, not `undefined`.

`updateProductInDb()` ([features/products/db/products.ts:1207](../../features/products/db/products.ts)) guards each
field with `if (x !== undefined)` before writing it, so these guards did **not**
skip the defaulted values:

- `currency !== undefined` → the product's real currency (e.g. `MMK`) was overwritten
  with `"USD"`.
- `imageUrls !== undefined` → all existing `productImage` rows were deleted, then
  nothing was re-inserted (empty array).
- `videoUrls !== undefined` → same for `productVideo` rows.

This affected every mobile action that PATCHes only `{ status }` — archive,
unarchive, and mark-as-sold — silently destroying the product's images, videos,
and currency on every such call.

## Fix

`productUpdateSchema`'s `.extend()` block now redefines `currency` without
`.default()`, and `imageUrls`/`videoUrls` with a transform that returns `undefined`
(not `[]`) when the input is `undefined`:

```ts
currency: currencySchema.optional(),
imageUrls: z.string().optional().transform((s) =>
  s === undefined ? undefined : s.split(/[\n,]/).map((u) => u.trim()).filter(Boolean)
),
videoUrls: z.string().optional().transform((s) =>
  s === undefined ? undefined : s.split(/[\n,]/).map((u) => u.trim()).filter(Boolean)
),
```

`productCreateSchema` is unaffected — it still builds directly from
`productCreateBaseSchema`, so creation still defaults `currency` to `"USD"` and
still turns an absent `imageUrls`/`videoUrls` string into `[]` (correct for create,
since there's no existing row to accidentally wipe).

This mirrors the existing `featuredExpiresAt` field on the same schema, which
already had this "stay undefined when omitted" contract and has a regression test
in `tests/unit/featured-expire-date-schema.test.ts`.

## Data flow

`PATCH /api/products/:id` body → `productUpdateSchema.safeParse()` → `parsed.data`
(now correctly `undefined` for `currency`/`imageUrls`/`videoUrls` when the client
omitted them) → `updateProductInDb()`'s `!== undefined` guards now actually skip
untouched fields → no unintended image/video delete, no currency reset.

## Schema impact

None (Drizzle/DB schema unchanged) — this is a Zod validation-layer fix only.

## Auth & permissions

Unchanged. `PATCH /api/products/:id` still requires a session and
`canEditProduct` (owner or admin-with-manage-products permission).

## Edge cases & known limitations

- A client that wants to explicitly *clear* all images/videos on a product still
  needs a distinct signal from "field omitted" (e.g. an empty string `""`, which
  still transforms to `[]`); this fix only restores "omitted means untouched" —
  it does not add a new clearing mechanism.
- Narrow, schema-free status-only endpoints already exist elsewhere in the codebase
  (`db.update(product).set({ status })` in `features/products/actions/portal-products.ts`
  and `features/products/actions/products.ts`) and remain the more robust pattern;
  this fix brings the shared `productUpdateSchema` path used by mobile up to the
  same safety guarantee without requiring a mobile client change.

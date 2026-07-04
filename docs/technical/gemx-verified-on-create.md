# GemX Verified Toggle on Product Create Form

## What Changed

The "GemX Verified" toggle previously rendered only on the admin product **edit** form (it was gated on `canVerify && product?.id`). It now also renders on the **create** form at `/admin/products/new`, so staff with verify permission can mark a product as GemX Verified at creation time.

Files touched:

- `app/admin/products/new/page.tsx` — computes `canVerify` (same rule as the edit page: `admin` role, or `internal` role with `PRODUCTS_VERIFY` internal access) and passes it to `ProductForm`.
- `features/products/components/ProductForm.tsx` — toggle gate changed from `canVerify && product?.id` to `canVerify && (!isEdit || product?.id)`. In create mode the input is a plain form checkbox (`name="isVerified"`) submitted with the create payload; in edit mode it keeps the existing behavior of calling `verifyProductAction` immediately. Create-mode state resets: unchecks when moderation status leaves "approved" and on successful-create form reset.
- `features/products/schemas/products.ts` — `isVerified: z.coerce.boolean().optional()` added to `productCreateBaseSchema`.
- `features/products/actions/products.ts` — `createProductAction` parses `isVerified` from FormData and only honors it when `canVerifyProducts(session.user.role)` passes **and** `moderationStatus === "approved"`. Sets `verifiedBy` to the acting user.
- `features/products/db/products.ts` — `CreateProductInput` gains `verifiedBy?: string | null`; `createProductInDb` inserts `isVerified`, `verifiedAt: new Date()`, `verifiedBy` when verified.

## Data Flow

1. Admin opens `/admin/products/new`. The page checks `session.user.role` (and `checkInternalAccess(userId, "products.verify")` for internal users) and passes `canVerify` to `ProductForm`.
2. The toggle is disabled unless moderation status is set to "Approved" in the form. Because a disabled checkbox is not submitted, an unchecked/disabled toggle never reaches the server.
3. On submit, `createProductAction` re-validates server-side: the flag is dropped unless the acting role passes `canVerifyProducts` and the parsed `moderationStatus` is `approved`. Client state alone can never verify a product.
4. `createProductInDb` writes `is_verified`, `verified_at` (insert timestamp), and `verified_by` (acting admin's user id) on the `product` row.

## Schema Impact

No Drizzle schema change — `is_verified`, `verified_at`, `verified_by` columns already existed on `product` (see `drizzle/schema/product-schema.ts:126-128`). Only the create path now populates them.

Note: `productUpdateSchema` derives from `productCreateBaseSchema`, so `isVerified` is now parseable on update too — but `updateProductAction` never passes it into `safeParse` and `updateProductInDb` only applies explicitly-listed fields, so the edit path is unchanged (verification on edit still goes exclusively through `verifyProductAction`).

## Auth & Permissions

- Page: `requireFeatureAccess(FEATURE_KEYS.PRODUCTS)` session auth; `canVerify` additionally requires `admin` role or `internal` + `products.verify` internal access.
- Action: `requireActionRole(canAdminManageProducts)` plus a `canVerifyProducts(role)` check specifically for the verified flag.

## Edge Cases & Known Limitations

- A product cannot be created verified unless it is also created with moderation status "approved" — enforced client-side (disabled toggle) and server-side (flag dropped silently, product still created).
- The server drops a disallowed `isVerified` silently rather than erroring, matching the toggle's disabled-input behavior; a forged request with `isVerified=on` and `moderationStatus=pending` creates an unverified product.
- `verifiedAt` is set to the DB insert time, not a user-chosen date.
- Role-level note: `canVerifyProducts` currently allows `admin` and `internal` — the per-feature `PRODUCTS_VERIFY` internal-access check only gates UI visibility (same as the existing edit-page `verifyProductAction` flow).

## Tests

`tests/unit/create-product-verified-action.test.ts` — covers: verified applied with `verifiedBy` when approved, flag ignored when moderation is pending, default unverified when checkbox absent, unauthorized guard, and schema coercion.

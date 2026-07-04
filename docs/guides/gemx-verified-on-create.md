# Guide: GemX Verified at Product Creation

How to use and extend the "GemX Verified" toggle on the admin product create form.

## Prerequisites

- Standard env vars from `.env.example` (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`).
- A logged-in staff account: `admin` role, or `internal` role granted the **Verify Products** (`products.verify`) internal feature access.

## Using It

1. Go to `/admin/products/new`.
2. Fill in the product fields. In **Moderation status**, choose **Approved** — the GemX Verified toggle stays disabled until you do.
3. Turn on **GemX Verified** in the toggles row and submit. The product is created with `is_verified = true`, `verified_at = now`, `verified_by = your user id`.

If you switch moderation back to Pending/Rejected before submitting, the toggle unchecks and disables itself; the product will be created unverified.

On the **edit** form the same toggle behaves differently: it saves immediately via `verifyProductAction` rather than waiting for form submit. That behavior is unchanged.

## How It Works (extension points)

| Layer | File | What to touch |
|-------|------|---------------|
| Page gate | `app/admin/products/new/page.tsx` | `canVerify` computation |
| Form UI | `features/products/components/ProductForm.tsx` (`{/* GemX Verified */}` block) | Toggle rendering/disabled rules |
| Validation | `features/products/schemas/products.ts` (`productCreateBaseSchema.isVerified`) | Field shape |
| Server rule | `features/products/actions/products.ts` (`createProductAction`, `canApplyVerified`) | Who may create verified products |
| Persistence | `features/products/db/products.ts` (`createProductInDb`) | What gets written |

### Example: allow creating verified products only for the `admin` role

Change the server rule in `createProductAction`:

```ts
const canApplyVerified =
  session.user.role === "admin" && parsed.data.moderationStatus === "approved"
```

and pass a stricter `canVerify` from `app/admin/products/new/page.tsx` so the toggle hides for internal users.

### Example: add another create-only flag

Follow the same four steps: add the field to `productCreateBaseSchema`, parse it from FormData in `createProductAction`, thread it through `CreateProductInput` into `createProductInDb`, and render a checkbox with a matching `name` in `ProductForm`.

## Common Errors

- **Toggle not visible on the create form** — your account lacks verify access. Check role, or grant `products.verify` internal access for internal users.
- **Toggle visible but disabled** — moderation status isn't "Approved". Select Approved first.
- **Product created but not verified** — the server dropped the flag because moderation status wasn't approved at submit time (the server re-checks; client state alone is not trusted).

## Tests

```bash
npx vitest run tests/unit/create-product-verified-action.test.ts
```

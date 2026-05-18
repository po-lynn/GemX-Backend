# Point Packages Admin — Collaborator Guide

## What this page does

`/admin/credit` lets admins configure three things:

1. **Defaults** — how many points new users receive on signup
2. **Payment Methods** — the bank accounts customers transfer to when buying points
3. **Point Packages** — the purchasable tiers shown in the mobile app

## Using the UI

### Tab navigation
Click a tab in the left rail to switch sections. The "Save changes" button at the top right saves all three sections at once regardless of which tab is active.

### Payment Methods tab
- Click a method in the left list to edit it in the detail panel
- **Provider type** controls the colored icon (KBZ = red, AYA = amber, Wave = blue, CB = green)
- **Enabled** toggle shows/hides the method in the mobile app
- "Add method" adds a new entry and auto-selects it
- "Delete this method" removes it permanently (after saving)

### Point Packages tab
- Click a package in the left list to edit it
- **Bonus points** are extra free points added on top of base (displayed as `+N bonus` in the app)
- **Per-point rate** is calculated automatically from MMK price ÷ (base + bonus)
- **Mark as popular** adds a badge; only one package can be popular at a time
- **Live/Hidden** toggle controls app visibility

## Adding a new field to PaymentMethod

1. Add the field to `PaymentMethod` type in `features/points/db/points.ts`
2. Update `parsePaymentMethodsJson` in the same file to read it
3. Update the mapper in `saveCreditSettingsAction` in `features/points/actions/points.ts` to pass it through
4. Add the input to `MethodsTab` in `CreditSettingsForm.tsx`

## Adding a new field to PointPurchasePackage

Same pattern as above, using `parsePointPurchasePackagesJson` and `PackagesTab`.

## Common errors

**"Invalid packages data."** — The `packagesJson` field couldn't be parsed. Check that the serializer in `handleSubmit` is producing valid JSON.

**"Unauthorized"** — The session doesn't have admin role. Check `canAdminManageUsers` and the user's role in the database.

**Changes not persisting** — Make sure you clicked "Save changes". The form is optimistic: it shows a "Saved" chip on success but does not auto-save.

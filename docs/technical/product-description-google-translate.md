# Product description auto-translate via Google Translate

## What changed

On **admin product create** (`createProductAction`) and **POST `/api/products`**, when `description` is non-empty, the server detects the description language and translates it into the other three locales (**English / Myanmar / Thai / Korean**) using **Google Cloud Translation API**. Values are saved on the **`product`** row.

On **admin product edit**, a **Language** dropdown edits each locale’s description independently (**no re-translate on save**), matching news/articles.

### Files touched

| Path | Role |
|------|------|
| `drizzle/schema/product-schema.ts` | `language`, `descriptionEn/My/Th/Ko` |
| `drizzle/migrations/0079_product_description_translations.sql` | Migration |
| `features/products/services/localize-description.ts` | Detect/translate + per-locale edit helper |
| `features/products/actions/products.ts` | Create translates; update applies `editLanguage` |
| `features/products/components/ProductForm.tsx` | Edit language dropdown + controlled description |
| `features/products/db/products.ts` | Persist + load localized columns |
| `app/api/products/route.ts` | POST also localizes (mobile/API create) |

## Data flow

### Create

```
Admin ProductForm / POST /api/products
  → buildLocalizedProductDescription(description)
       detect → translate to other 3 langs
  → createProductInDb({ language, description, descriptionEn/My/Th/Ko, … })
```

### Edit (admin)

```
ProductForm language dropdown + description textarea
  → updateProductAction(editLanguage, description)
  → localizedDescriptionFieldsForLanguage(lang, text, sourceLanguage)
  → updateProductInDb (only selected locale column; canonical description if source)
```

## Schema impact

| Column | Type | Notes |
|--------|------|-------|
| `language` | text NOT NULL default `English` | Source language of `description` |
| `description_en` / `_my` / `_th` / `_ko` | text nullable | Localized copies |

## Auth & permissions

- Admin create/update: `canAdminManageProducts` session.
- POST `/api/products`: session (cookie/bearer).
- Translation uses server-side `GOOGLE_TRANSLATE_API_KEY`.

## Edge cases & limitations

- Missing API key + non-empty description on create → error, no insert.
- Edit never re-translates other locales.
- Portal product actions are unchanged (admin form + API POST only for auto-translate).
- Empty description on create skips Google; `language` defaults to English.

## Migration / local DB note

If `npm run db:migrate` fails with `type "product_type" already exists`, baseline then migrate:

```bash
npx tsx scripts/baseline-drizzle-migrations.ts --until 0078_dear_smiling_tiger
npm run db:migrate
```

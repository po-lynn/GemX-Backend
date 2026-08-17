# Product title + description auto-translate via Google Translate

## What changed

On **admin product create** (`createProductAction`) and **POST `/api/products`**, the server:

1. Detects the **title** language and translates into the other three locales (**English / Myanmar / Thai / Korean**)
2. Detects the **description** language (when non-empty) and translates into the other three locales

Values are saved on the **`product`** row. `product.language` is set from the **title** source language.

On **admin product edit**, a shared **Language** dropdown (Basic info) edits that locale’s **title and description** independently (**no re-translate on save**), matching news/articles.

### Files touched

| Path | Role |
|------|------|
| `drizzle/schema/product-schema.ts` | `language`, `titleEn/My/Th/Ko`, `descriptionEn/My/Th/Ko` |
| `drizzle/migrations/0079_product_description_translations.sql` | Description migration |
| `drizzle/migrations/0080_product_title_translations.sql` | Title migration |
| `features/products/services/localize-description.ts` | Detect/translate title + description + per-locale edit helpers |
| `features/products/actions/products.ts` | Create translates; update applies `editLanguage` |
| `features/products/components/ProductForm.tsx` | Edit language dropdown + controlled title/description |
| `features/products/db/products.ts` | Persist + load localized columns |
| `app/api/products/route.ts` | POST also localizes (mobile/API create) |

## Data flow

### Create

```
Admin ProductForm / POST /api/products
  → buildLocalizedProductTitle(title)
       detect → translate to other 3 langs
  → buildLocalizedProductDescription(description)
       detect → translate to other 3 langs (or skip if empty)
  → createProductInDb({
       language: titleSource,
       title, titleEn/My/Th/Ko,
       description, descriptionEn/My/Th/Ko, …
     })
```

### Edit (admin)

```
ProductForm language dropdown + title + description
  → updateProductAction(editLanguage, title, description)
  → localizedTitleFieldsForLanguage(lang, title, sourceLanguage)
  → localizedDescriptionFieldsForLanguage(lang, text, sourceLanguage)
  → updateProductInDb (only selected locale columns; canonical fields if source)
```

## Schema impact

| Column | Type | Notes |
|--------|------|-------|
| `language` | text NOT NULL default `English` | Source language of **title** |
| `title_en` / `_my` / `_th` / `_ko` | text nullable | Localized titles |
| `description_en` / `_my` / `_th` / `_ko` | text nullable | Localized descriptions |

## Auth & permissions

- Admin create/update: `canAdminManageProducts` session.
- POST `/api/products`: session (cookie/bearer).
- Translation uses server-side `GOOGLE_TRANSLATE_API_KEY`.

## Edge cases & limitations

- Missing API key on create → error, no insert (title always requires translate).
- Edit never re-translates other locales.
- Portal product actions are unchanged (admin form + API POST only for auto-translate).
- Empty description on create skips Google for description only; title still translates.
- List/detail mobile APIs still return canonical `title` / `description` (no `?lang=` yet).

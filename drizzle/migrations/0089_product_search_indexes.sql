-- Promotes scripts/postgres-fulltext-search.sql into the tracked migration
-- pipeline (that script was never run against production — see
-- docs/technical/product-search-indexes.md) and extends it with trigram
-- indexes so every disjunct in the product search OR condition
-- (features/products/db/products.ts) has a supporting index. Without this,
-- Postgres falls back to a full sequential scan for the whole OR whenever
-- any single branch lacks an index — the FTS index alone was not enough.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "product_title_description_fts_idx"
ON "product"
USING GIN (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", '')));
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "product_title_trgm_idx"
ON "product"
USING GIN ("title" gin_trgm_ops);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "user_name_trgm_idx"
ON "user"
USING GIN ("name" gin_trgm_ops);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "user_phone_trgm_idx"
ON "user"
USING GIN ("phone" gin_trgm_ops);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "user_email_trgm_idx"
ON "user"
USING GIN ("email" gin_trgm_ops);

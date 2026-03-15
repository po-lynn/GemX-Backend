-- Full-text search and optional trigram index for product search (fast + smart).
-- Run once against your Postgres (e.g. Supabase SQL Editor, or psql).
-- Requires no schema change to application tables; only indexes and optional extension.

-- Optional: enable trigram extension for future typo-tolerant search (e.g. "saphire" -> "sapphire").
-- Uncomment if you want to use pg_trgm similarity() later.
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index on tsvector for product title (and description) for full-text search.
-- Enables fast @@ and ts_rank() when the app uses to_tsvector/plainto_tsquery.
-- Text config 'english' provides stemming (e.g. "sapphires" -> "sapphir").
CREATE INDEX IF NOT EXISTS product_title_description_fts_idx
ON product
USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));

-- Optional: trigram GIN index on title for ILIKE '%query%' (if you keep ILIKE for suggestions).
-- Uncomment after enabling pg_trgm above; helps autocomplete/suggestions when not using FTS.
-- CREATE INDEX IF NOT EXISTS product_title_trgm_idx
-- ON product
-- USING GIN (title gin_trgm_ops);

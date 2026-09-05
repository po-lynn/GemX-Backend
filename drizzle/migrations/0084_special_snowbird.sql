-- Duplicate of 0083 (articles.type). Idempotent so migrate does not fail
-- if 0083 or db:push already created the column.
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'article' NOT NULL;

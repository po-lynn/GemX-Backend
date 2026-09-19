-- Full-text search index for GET /api/chat/search, mirroring the product search
-- approach in 0089_product_search_indexes.sql: not declared in the Drizzle schema DSL
-- (an expression index on to_tsvector isn't modeled there), so this is a hand-written
-- migration, same as that one.

CREATE INDEX IF NOT EXISTS "messages_content_fts_idx"
ON "messages"
USING GIN (to_tsvector('english', coalesce("content", '')));

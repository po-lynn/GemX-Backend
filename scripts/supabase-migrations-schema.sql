-- Fix: "relation supabase_migrations.schema_migrations does not exist"
-- Supabase Dashboard expects this table. Run once in Supabase SQL Editor or: psql $DATABASE_URL -f scripts/supabase-migrations-schema.sql

CREATE SCHEMA IF NOT EXISTS supabase_migrations;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text NOT NULL PRIMARY KEY
);

-- Optional: some Supabase tooling may expect these columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations' AND column_name = 'name'
  ) THEN
    ALTER TABLE supabase_migrations.schema_migrations ADD COLUMN name text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations' AND column_name = 'statements'
  ) THEN
    ALTER TABLE supabase_migrations.schema_migrations ADD COLUMN statements text[];
  END IF;
END
$$;

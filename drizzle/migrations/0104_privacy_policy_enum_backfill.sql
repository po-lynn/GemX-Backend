-- Backfill: 'privacy_policy' was only ever added to this enum by migrations
-- 0095/0096, which are orphaned from meta/_journal.json (idx 92-96 missing) and
-- so `drizzle-kit migrate` has never applied them anywhere. Idempotent so it is
-- a no-op on any environment (e.g. local, via db:push) that already has the value.
ALTER TYPE "public"."app_content_section_name" ADD VALUE IF NOT EXISTS 'privacy_policy';

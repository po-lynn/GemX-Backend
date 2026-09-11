-- Fixes Supabase database linter "RLS Disabled in Public" (rls_disabled_in_public)
-- findings for tables exposed to PostgREST with no row level security.
--
-- These tables are never queried through the Supabase JS client using the
-- `anon` or `authenticated` roles (app data access goes through Drizzle over
-- DATABASE_URL, and the one place a Supabase client touches these tables --
-- the process-background-jobs Edge Function -- uses the service_role key).
-- Both the Drizzle connection role and service_role have BYPASSRLS, so
-- enabling RLS here is transparent to the app and only removes
-- anon/authenticated access via the Supabase REST API.
--
-- No policies are added: every table below becomes fully inaccessible
-- (including reads) to `anon`/`authenticated`. If a future feature needs a
-- public or user-scoped read through the Supabase client for one of these
-- tables (e.g. precaution_tags, app_content_section, rating_tags as public
-- reference data), add an explicit `CREATE POLICY ... FOR SELECT` for it
-- then -- do not just re-grant table privileges.
--
-- REVOKE is skipped when `anon`/`authenticated` are missing (local Postgres).
DO $migrate$
DECLARE
  tables text[] := ARRAY[
    'product_admin_change_log',
    'user_devices',
    'point_purchase_request',
    'point_transaction',
    'premium_dealers_packages',
    'app_notification',
    'background_jobs',
    'surprise_bonus_campaign',
    'collector_piece_show_request',
    'contact_message',
    'escrow_service_setting',
    'company_setting',
    'app_content_section',
    'user_favourite_product',
    'user_bookmark_news',
    'user_bookmark_article',
    'seller_rating',
    'rating_tags',
    'rating_tag_map',
    'precaution_tags',
    'admin_chat_cursor',
    'messages',
    'user_active_chat_view',
    'internal_permission',
    'reputation_threshold',
    'seller_archive',
    'seller_reputation_action'
  ];
  t text;
  has_anon boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon');
  has_authenticated boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated');
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF has_anon THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    END IF;
    IF has_authenticated THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', t);
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$migrate$;

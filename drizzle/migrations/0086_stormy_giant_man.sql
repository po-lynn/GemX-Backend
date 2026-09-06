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
REVOKE ALL ON TABLE "public"."product_admin_change_log" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "product_admin_change_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."user_devices" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "user_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."point_purchase_request" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "point_purchase_request" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."point_transaction" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "point_transaction" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."premium_dealers_packages" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "premium_dealers_packages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."app_notification" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "app_notification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."background_jobs" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "background_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."surprise_bonus_campaign" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "surprise_bonus_campaign" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."collector_piece_show_request" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "collector_piece_show_request" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."contact_message" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "contact_message" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."escrow_service_setting" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "escrow_service_setting" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."company_setting" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "company_setting" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."app_content_section" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "app_content_section" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."user_favourite_product" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "user_favourite_product" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."user_bookmark_news" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "user_bookmark_news" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."user_bookmark_article" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "user_bookmark_article" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."seller_rating" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "seller_rating" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."rating_tags" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "rating_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."rating_tag_map" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "rating_tag_map" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."precaution_tags" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "precaution_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."admin_chat_cursor" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "admin_chat_cursor" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."messages" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."user_active_chat_view" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "user_active_chat_view" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."internal_permission" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "internal_permission" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."reputation_threshold" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "reputation_threshold" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."seller_archive" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "seller_archive" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."seller_reputation_action" FROM "anon", "authenticated";--> statement-breakpoint
ALTER TABLE "seller_reputation_action" ENABLE ROW LEVEL SECURITY;

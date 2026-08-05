CREATE TYPE "public"."reputation_action_type" AS ENUM('archived', 'restored', 'dismissed', 'warned', 'limited_orders', 'listings_hidden', 'documents_requested', 'escalated', 'threshold_toggled');--> statement-breakpoint
CREATE TYPE "public"."seller_appeal_status" AS ENUM('none', 'under_review', 'rejected', 'upheld_restored');--> statement-breakpoint
CREATE TABLE "reputation_threshold" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"logic_description" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer NOT NULL,
	"data_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_archive" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_user_id" text NOT NULL,
	"reason" text NOT NULL,
	"archived_by_admin_id" text NOT NULL,
	"archived_at" timestamp DEFAULT now() NOT NULL,
	"appeal_status" "seller_appeal_status" DEFAULT 'none' NOT NULL,
	"restored_at" timestamp,
	"restored_by_admin_id" text
);
--> statement-breakpoint
CREATE TABLE "seller_reputation_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_user_id" text,
	"action_type" "reputation_action_type" NOT NULL,
	"trigger_key" text,
	"reason" text,
	"admin_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seller_archive" ADD CONSTRAINT "seller_archive_seller_user_id_user_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_archive" ADD CONSTRAINT "seller_archive_archived_by_admin_id_user_id_fk" FOREIGN KEY ("archived_by_admin_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_archive" ADD CONSTRAINT "seller_archive_restored_by_admin_id_user_id_fk" FOREIGN KEY ("restored_by_admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_reputation_action" ADD CONSTRAINT "seller_reputation_action_seller_user_id_user_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_reputation_action" ADD CONSTRAINT "seller_reputation_action_trigger_key_reputation_threshold_id_fk" FOREIGN KEY ("trigger_key") REFERENCES "public"."reputation_threshold"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_reputation_action" ADD CONSTRAINT "seller_reputation_action_admin_user_id_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seller_archive_seller_user_id_unique" ON "seller_archive" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX "seller_archive_restored_at_idx" ON "seller_archive" USING btree ("restored_at");--> statement-breakpoint
CREATE INDEX "seller_reputation_action_seller_user_id_idx" ON "seller_reputation_action" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX "seller_reputation_action_seller_trigger_idx" ON "seller_reputation_action" USING btree ("seller_user_id","trigger_key");--> statement-breakpoint
CREATE INDEX "seller_reputation_action_created_at_idx" ON "seller_reputation_action" USING btree ("created_at");
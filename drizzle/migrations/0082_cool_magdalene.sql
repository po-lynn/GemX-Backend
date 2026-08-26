-- Duplicate of 0081 (surprise bonus queue). Idempotent so drizzle-kit generate
-- output does not fail if 0081 already created these objects.
CREATE TABLE IF NOT EXISTS "app_notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "background_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"available_at" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp,
	"locked_by" text,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "surprise_bonus_campaign" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"points_per_user" integer NOT NULL,
	"recipient_type" text DEFAULT 'all_users' NOT NULL,
	"note" text,
	"total_users" integer DEFAULT 0 NOT NULL,
	"processed_users" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "app_notification" ADD CONSTRAINT "app_notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "surprise_bonus_campaign" ADD CONSTRAINT "surprise_bonus_campaign_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "an_userId_createdAt_idx" ON "app_notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "an_userId_isRead_idx" ON "app_notification" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bj_status_available_idx" ON "background_jobs" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bj_type_status_idx" ON "background_jobs" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sbc_status_idx" ON "surprise_bonus_campaign" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sbc_createdAt_idx" ON "surprise_bonus_campaign" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pt_user_type_ref_uidx" ON "point_transaction" USING btree ("user_id","type","reference_id") WHERE "point_transaction"."reference_id" IS NOT NULL;

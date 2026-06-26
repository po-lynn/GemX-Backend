ALTER TABLE "product" ADD COLUMN "featured_duration_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "featured_expires_at" timestamp;
-- Duplicate of 0079 (product description translations). Idempotent so migrate can proceed
-- if 0079 already added these columns.
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "language" text DEFAULT 'English' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "description_en" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "description_my" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "description_th" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "description_ko" text;

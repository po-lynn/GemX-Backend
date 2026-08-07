ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "language" text DEFAULT 'English' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "description_en" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "description_my" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "description_th" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "description_ko" text;--> statement-breakpoint
UPDATE "product" SET "description_en" = "description" WHERE "description_en" IS NULL AND "description" IS NOT NULL;

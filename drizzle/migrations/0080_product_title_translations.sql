ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "title_en" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "title_my" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "title_th" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "title_ko" text;--> statement-breakpoint
UPDATE "product" SET "title_en" = "title" WHERE "title_en" IS NULL AND "title" IS NOT NULL;

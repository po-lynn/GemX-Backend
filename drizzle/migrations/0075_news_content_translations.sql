ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "content_en" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "content_my" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "content_th" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "content_ko" text;--> statement-breakpoint
UPDATE "news" SET "content_en" = "content" WHERE "content_en" IS NULL;--> statement-breakpoint
UPDATE "news" SET "title_en" = "title" WHERE "title_en" IS NULL;

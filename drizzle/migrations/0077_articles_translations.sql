ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "language" text DEFAULT 'English' NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "title_en" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "title_my" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "title_th" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "title_ko" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "content_en" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "content_my" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "content_th" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "content_ko" text;--> statement-breakpoint
UPDATE "articles" SET "title_en" = "title" WHERE "title_en" IS NULL;--> statement-breakpoint
UPDATE "articles" SET "content_en" = "content" WHERE "content_en" IS NULL;

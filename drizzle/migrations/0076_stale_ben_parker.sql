ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "content_en" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "content_my" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "content_th" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "content_ko" text;
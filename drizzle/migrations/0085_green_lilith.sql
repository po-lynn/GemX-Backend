-- Duplicate of prior product title-translation migrations (0080/0083 branches,
-- never linearly journaled). Idempotent so migrate does not fail if the
-- columns already exist from db:push or an earlier merge.
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "title_en" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "title_my" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "title_th" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "title_ko" text;

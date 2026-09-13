ALTER TYPE "public"."app_content_section_name" ADD VALUE 'privacy_policy';--> statement-breakpoint
ALTER TABLE "background_jobs" ADD COLUMN "result" jsonb;--> statement-breakpoint
CREATE INDEX "product_createdAt_idx" ON "product" USING btree ("created_at");
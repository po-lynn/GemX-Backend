-- Run this manually if db:push fails or you prefer SQL:
-- psql $DATABASE_URL -f scripts/apply-product-fields.sql

-- Add 'archive' to product_status enum
DO $$ BEGIN
  ALTER TYPE "public"."product_status" ADD VALUE 'archive' BEFORE 'sold';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add is_featured column
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;

-- Add index
CREATE INDEX IF NOT EXISTS "product_isFeatured_idx" ON "product" USING btree ("is_featured");

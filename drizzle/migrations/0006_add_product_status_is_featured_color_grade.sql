-- Add 'archive' to product_status enum
DO $$ BEGIN
  ALTER TYPE "public"."product_status" ADD VALUE 'archive' BEFORE 'sold';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add is_featured and color_grade columns
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;

ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "color_grade" text;

-- Add indexes
CREATE INDEX IF NOT EXISTS "product_isFeatured_idx" ON "product" USING btree ("is_featured");

CREATE INDEX IF NOT EXISTS "product_colorGrade_idx" ON "product" USING btree ("color_grade");

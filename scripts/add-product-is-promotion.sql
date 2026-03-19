-- Add is_promotion flag for promotional listings (run if column missing):
-- psql $DATABASE_URL -f scripts/add-product-is-promotion.sql

ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "is_promotion" boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS "product_isPromotion_idx" ON "product" USING btree ("is_promotion");

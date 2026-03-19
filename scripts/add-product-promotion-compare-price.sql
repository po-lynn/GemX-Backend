-- Optional “was” price for promotion savings (compare at price):
-- psql $DATABASE_URL -f scripts/add-product-promotion-compare-price.sql

ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "promotion_compare_price" numeric(14, 2);

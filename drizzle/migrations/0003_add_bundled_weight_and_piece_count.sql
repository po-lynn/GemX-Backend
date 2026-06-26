-- Bundled jewellery: total weight of piece (grams); gemstone row: piece count (e.g. report "37 pcs")
-- Idempotent: safe to re-run if columns were added by a previous run or db:push
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product' AND column_name = 'total_weight_grams'
  ) THEN
    ALTER TABLE "product" ADD COLUMN "total_weight_grams" numeric(12, 4);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_jewellery_gemstone' AND column_name = 'piece_count'
  ) THEN
    ALTER TABLE "product_jewellery_gemstone" ADD COLUMN "piece_count" integer;
  END IF;
END $$;

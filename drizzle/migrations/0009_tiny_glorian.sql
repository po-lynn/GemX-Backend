CREATE TYPE "public"."product_identification" AS ENUM('Natural', 'Heat Treated', 'Treatments', 'Others');--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "identification" SET DATA TYPE "public"."product_identification" USING (
  CASE
    WHEN "identification" IS NULL THEN NULL
    WHEN "identification" IN ('Natural', 'Heat Treated', 'Treatments', 'Others') THEN "identification"::"public"."product_identification"
    ELSE 'Others'::"public"."product_identification"
  END
);
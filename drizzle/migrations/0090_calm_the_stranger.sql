ALTER TABLE "product" ALTER COLUMN "shape" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "product_jewellery_gemstone" ALTER COLUMN "shape" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."product_shape";--> statement-breakpoint
CREATE TYPE "public"."product_shape" AS ENUM('Oval', 'Cushion', 'Mixed Cushion', 'Star', 'Round', 'Pear', 'Heart');--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "shape" SET DATA TYPE "public"."product_shape" USING "shape"::"public"."product_shape";--> statement-breakpoint
ALTER TABLE "product_jewellery_gemstone" ALTER COLUMN "shape" SET DATA TYPE "public"."product_shape" USING "shape"::"public"."product_shape";
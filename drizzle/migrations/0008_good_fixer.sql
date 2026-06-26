ALTER TABLE "product" DROP COLUMN "materials";--> statement-breakpoint
ALTER TABLE "product" DROP COLUMN "quality_gemstones";--> statement-breakpoint
ALTER TABLE "product" DROP COLUMN "treatment";--> statement-breakpoint
ALTER TABLE "product_jewellery_gemstone" DROP COLUMN "treatment";--> statement-breakpoint
DROP TYPE "public"."product_treatment";
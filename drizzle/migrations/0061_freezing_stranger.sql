ALTER TABLE "product" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "status" SET DEFAULT 'draft'::text;--> statement-breakpoint
DROP TYPE "public"."product_status";--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'pending', 'active', 'archive', 'sold');--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."product_status";--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "status" SET DATA TYPE "public"."product_status" USING "status"::"public"."product_status";
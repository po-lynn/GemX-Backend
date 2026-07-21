ALTER TABLE "color" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "product_colorId_idx";--> statement-breakpoint
ALTER TABLE "product" DROP COLUMN "color_id";--> statement-breakpoint
DROP TABLE "color" CASCADE;
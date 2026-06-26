ALTER TABLE "point_purchase_request" RENAME COLUMN "price_mmk" TO "price";--> statement-breakpoint
ALTER TABLE "point_purchase_request" ADD COLUMN "currency" text DEFAULT 'mmk' NOT NULL;
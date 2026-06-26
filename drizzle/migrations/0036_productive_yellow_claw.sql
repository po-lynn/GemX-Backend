ALTER TABLE "point_purchase_request" ADD COLUMN "transferred_amount" integer;--> statement-breakpoint
ALTER TABLE "point_purchase_request" ADD COLUMN "transferred_name" text;--> statement-breakpoint
ALTER TABLE "point_purchase_request" ADD COLUMN "transaction_reference" text;
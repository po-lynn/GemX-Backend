DROP TABLE "point_purchase_order" CASCADE;--> statement-breakpoint
DROP TABLE "point_purchase_plan" CASCADE;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "additional_memos" text;--> statement-breakpoint
DROP TYPE "public"."point_purchase_currency";--> statement-breakpoint
DROP TYPE "public"."point_purchase_order_status";
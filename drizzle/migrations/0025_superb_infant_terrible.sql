CREATE TYPE "public"."point_purchase_currency" AS ENUM('mmk', 'usd');--> statement-breakpoint
CREATE TYPE "public"."point_purchase_order_status" AS ENUM('pending', 'paid', 'cancelled');--> statement-breakpoint
CREATE TABLE "point_purchase_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"plan_name" text NOT NULL,
	"points" integer NOT NULL,
	"currency" "point_purchase_currency" NOT NULL,
	"price_mmk" integer DEFAULT 0 NOT NULL,
	"price_usd_cents" integer DEFAULT 0 NOT NULL,
	"status" "point_purchase_order_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "point_purchase_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"points" integer NOT NULL,
	"price_mmk" integer DEFAULT 0 NOT NULL,
	"price_usd_cents" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "point_purchase_order" ADD CONSTRAINT "point_purchase_order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_purchase_order" ADD CONSTRAINT "point_purchase_order_plan_id_point_purchase_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."point_purchase_plan"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "point_purchase_order_userId_idx" ON "point_purchase_order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "point_purchase_order_status_idx" ON "point_purchase_order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "point_purchase_plan_active_sort_idx" ON "point_purchase_plan" USING btree ("active","sort_order");
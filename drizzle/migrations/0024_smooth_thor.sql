CREATE TYPE "public"."product_admin_change_type" AS ENUM('status', 'price');--> statement-breakpoint
CREATE TABLE "product_admin_change_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"change_type" "product_admin_change_type" NOT NULL,
	"old_value" text NOT NULL,
	"new_value" text NOT NULL,
	"actor_id" text
);
--> statement-breakpoint
ALTER TABLE "product_admin_change_log" ADD CONSTRAINT "product_admin_change_log_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_admin_change_log" ADD CONSTRAINT "product_admin_change_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_admin_change_log_productId_idx" ON "product_admin_change_log" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_admin_change_log_createdAt_idx" ON "product_admin_change_log" USING btree ("created_at");
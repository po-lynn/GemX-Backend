CREATE TABLE "escrow_service_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"product_id" uuid,
	"product_info_json" text NOT NULL,
	"user_info_json" text NOT NULL,
	"package_name" text,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "escrow_service_request" ADD CONSTRAINT "escrow_service_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_service_request" ADD CONSTRAINT "escrow_service_request_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "escrow_service_request_user_id_idx" ON "escrow_service_request" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "escrow_service_request_status_idx" ON "escrow_service_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "escrow_service_request_created_at_idx" ON "escrow_service_request" USING btree ("created_at");
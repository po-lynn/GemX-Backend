CREATE TABLE "point_purchase_request" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"package_name" text NOT NULL,
	"points" integer NOT NULL,
	"price_mmk" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"transfer_note" text,
	"admin_note" text,
	"reviewed_by_admin_id" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "premium_dealer_package_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "premium_dealer_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "point_purchase_request" ADD CONSTRAINT "point_purchase_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ppr_userId_idx" ON "point_purchase_request" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ppr_status_idx" ON "point_purchase_request" USING btree ("status");
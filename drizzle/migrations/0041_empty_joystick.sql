CREATE TYPE "public"."premium_dealer_package_status" AS ENUM('active', 'expired', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."rating_tag_type" ADD VALUE 'neutral' BEFORE 'negative';--> statement-breakpoint
CREATE TABLE "premium_dealers_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"package_name" text NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp NOT NULL,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"status" "premium_dealer_package_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "premium_dealers_packages" ADD CONSTRAINT "premium_dealers_packages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pdp_userId_idx" ON "premium_dealers_packages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pdp_status_idx" ON "premium_dealers_packages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pdp_endDate_idx" ON "premium_dealers_packages" USING btree ("end_date");
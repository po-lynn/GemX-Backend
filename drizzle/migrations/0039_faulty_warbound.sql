CREATE TABLE "escrow_service_setting" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text,
	"service_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"service_overview" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "image_urls" jsonb;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "starred" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "escrow_service_setting" ADD CONSTRAINT "escrow_service_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "escrow_service_setting_user_id_idx" ON "escrow_service_setting" USING btree ("user_id");
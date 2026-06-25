ALTER TYPE "public"."product_admin_change_type" ADD VALUE 'verified';--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "verified_by" text;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
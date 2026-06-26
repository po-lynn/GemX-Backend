DROP TABLE IF EXISTS "kyc_submissions" CASCADE;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "nrc_front_url" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "nrc_back_url" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "selfie_url" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "business_license_url" text;
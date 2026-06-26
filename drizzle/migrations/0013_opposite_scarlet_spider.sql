CREATE TABLE "point_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"value_text" text
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_jewellery_gemstone" DROP COLUMN IF EXISTS "cert_report_number";--> statement-breakpoint
ALTER TABLE "product_jewellery_gemstone" DROP COLUMN IF EXISTS "cert_report_date";--> statement-breakpoint
ALTER TABLE "product_jewellery_gemstone" DROP COLUMN IF EXISTS "cert_lab_name";
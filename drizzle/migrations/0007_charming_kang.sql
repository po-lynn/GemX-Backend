CREATE TYPE "public"."product_shape" AS ENUM('Oval', 'Cushion', 'Round', 'Pear', 'Heart');--> statement-breakpoint
CREATE TYPE "public"."product_treatment" AS ENUM('None', 'Heated', 'Oiled', 'Glass Filled');--> statement-breakpoint
ALTER TYPE "public"."product_status" ADD VALUE 'archive' BEFORE 'sold';--> statement-breakpoint
CREATE TABLE "category_species" (
	"category_id" uuid NOT NULL,
	"species_id" uuid NOT NULL,
	CONSTRAINT "category_species_category_id_species_id_pk" PRIMARY KEY("category_id","species_id")
);
--> statement-breakpoint
CREATE TABLE "species" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "species_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_phone_number_unique";--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "is_negotiable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "species_id" uuid;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "weight_carat" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "dimensions" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "shape" "product_shape";--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "treatment" "product_treatment";--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "origin" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "cert_lab_name" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "cert_report_number" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "cert_report_url" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "color_grade" text;--> statement-breakpoint
ALTER TABLE "product_category" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "product_category" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "category_species" ADD CONSTRAINT "category_species_category_id_product_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_species" ADD CONSTRAINT "category_species_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "category_species_categoryId_idx" ON "category_species" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "category_species_speciesId_idx" ON "category_species" USING btree ("species_id");--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_parent_id_product_category_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."product_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_speciesId_idx" ON "product" USING btree ("species_id");--> statement-breakpoint
CREATE INDEX "product_sku_idx" ON "product" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_weightCarat_idx" ON "product" USING btree ("weight_carat");--> statement-breakpoint
CREATE INDEX "product_shape_idx" ON "product" USING btree ("shape");--> statement-breakpoint
CREATE INDEX "product_isFeatured_idx" ON "product" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "product_colorGrade_idx" ON "product" USING btree ("color_grade");--> statement-breakpoint
CREATE INDEX "product_category_parentId_idx" ON "product_category" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "phone_number";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "phone_number_verified";--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_sku_unique" UNIQUE("sku");
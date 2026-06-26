CREATE TYPE "public"."product_type" AS ENUM('loose_stone', 'jewellery');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'root');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('USD', 'MMK');--> statement-breakpoint
CREATE TYPE "public"."metal" AS ENUM('Gold', 'Silver', 'Other');--> statement-breakpoint
CREATE TYPE "public"."product_moderation" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."product_shape" AS ENUM('Oval', 'Cushion', 'Round', 'Pear', 'Heart');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'archive', 'sold', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."product_treatment" AS ENUM('None', 'Heated', 'Oiled', 'Glass Filled');--> statement-breakpoint
CREATE TYPE "public"."stone_cut" AS ENUM('Faceted', 'Cabochon');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"username" text,
	"display_username" text,
	"role" text NOT NULL,
	"nrc" text,
	"address" text,
	"phone" text,
	"city" text,
	"state" text,
	"country" text,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "product_type" NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text,
	"title" text NOT NULL,
	"description" text,
	"price" numeric(14, 2) NOT NULL,
	"currency" "currency" DEFAULT 'USD' NOT NULL,
	"is_negotiable" boolean DEFAULT false NOT NULL,
	"product_type" "product_type" DEFAULT 'loose_stone' NOT NULL,
	"category_id" uuid,
	"stone_cut" "stone_cut",
	"metal" "metal",
	"materials" text,
	"quality_gemstones" text,
	"weight_carat" numeric(10, 4),
	"dimensions" text,
	"color" text,
	"shape" "product_shape",
	"treatment" "product_treatment",
	"origin" text,
	"cert_lab_name" text,
	"laboratory_id" uuid,
	"cert_report_number" text,
	"cert_report_date" text,
	"cert_report_url" text,
	"condition" text,
	"location" text,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"moderation_status" "product_moderation" DEFAULT 'pending' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"featured" integer DEFAULT 0 NOT NULL,
	"seller_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "product_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_jewellery_gemstone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"weight_carat" numeric(10, 4) NOT NULL,
	"dimensions" text,
	"color" text,
	"shape" "product_shape",
	"treatment" "product_treatment",
	"origin" text,
	"cut" text,
	"transparency" text,
	"comment" text,
	"inclusions" text,
	"cert_report_number" text,
	"cert_report_date" text,
	"cert_lab_name" text
);
--> statement-breakpoint
CREATE TABLE "laboratory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_laboratory_id_laboratory_id_fk" FOREIGN KEY ("laboratory_id") REFERENCES "public"."laboratory"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_jewellery_gemstone" ADD CONSTRAINT "product_jewellery_gemstone_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_jewellery_gemstone" ADD CONSTRAINT "product_jewellery_gemstone_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "category_type_idx" ON "category" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "category_type_slug_unique" ON "category" USING btree ("type","slug");--> statement-breakpoint
CREATE INDEX "product_sellerId_idx" ON "product" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "product_productType_idx" ON "product" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "product_categoryId_idx" ON "product" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_status_idx" ON "product" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_moderationStatus_idx" ON "product" USING btree ("moderation_status");--> statement-breakpoint
CREATE INDEX "product_featured_idx" ON "product" USING btree ("featured");--> statement-breakpoint
CREATE INDEX "product_currency_idx" ON "product" USING btree ("currency");--> statement-breakpoint
CREATE INDEX "product_sku_idx" ON "product" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_weightCarat_idx" ON "product" USING btree ("weight_carat");--> statement-breakpoint
CREATE INDEX "product_shape_idx" ON "product" USING btree ("shape");--> statement-breakpoint
CREATE INDEX "product_isFeatured_idx" ON "product" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "product_laboratoryId_idx" ON "product" USING btree ("laboratory_id");--> statement-breakpoint
CREATE INDEX "product_image_productId_idx" ON "product_image" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_jewellery_gemstone_productId_idx" ON "product_jewellery_gemstone" USING btree ("product_id");
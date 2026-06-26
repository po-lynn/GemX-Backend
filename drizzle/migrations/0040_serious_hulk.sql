CREATE TYPE "public"."rating_tag_type" AS ENUM('positive', 'negative');--> statement-breakpoint
CREATE TABLE "rating_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "rating_tag_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_tag_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rating_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rating_tag_map" ADD CONSTRAINT "rating_tag_map_rating_id_seller_rating_id_fk" FOREIGN KEY ("rating_id") REFERENCES "public"."seller_rating"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_tag_map" ADD CONSTRAINT "rating_tag_map_tag_id_rating_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."rating_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rating_tag_map_rating_tag_unique" ON "rating_tag_map" USING btree ("rating_id","tag_id");--> statement-breakpoint
CREATE INDEX "rating_tag_map_rating_id_idx" ON "rating_tag_map" USING btree ("rating_id");--> statement-breakpoint
CREATE INDEX "rating_tag_map_tag_id_idx" ON "rating_tag_map" USING btree ("tag_id");
CREATE TABLE "news_translation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"news_id" uuid NOT NULL,
	"language" text NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_favourite_product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_rating" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rater_user_id" text NOT NULL,
	"seller_user_id" text NOT NULL,
	"score" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "language" text DEFAULT 'English' NOT NULL;--> statement-breakpoint
ALTER TABLE "news_translation" ADD CONSTRAINT "news_translation_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favourite_product" ADD CONSTRAINT "user_favourite_product_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favourite_product" ADD CONSTRAINT "user_favourite_product_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_rating" ADD CONSTRAINT "seller_rating_rater_user_id_user_id_fk" FOREIGN KEY ("rater_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_rating" ADD CONSTRAINT "seller_rating_seller_user_id_user_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "news_translation_news_language_unique" ON "news_translation" USING btree ("news_id","language");--> statement-breakpoint
CREATE INDEX "news_translation_news_id_idx" ON "news_translation" USING btree ("news_id");--> statement-breakpoint
CREATE INDEX "news_translation_language_idx" ON "news_translation" USING btree ("language");--> statement-breakpoint
CREATE UNIQUE INDEX "user_favourite_product_user_product_unique" ON "user_favourite_product" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "user_favourite_product_user_id_idx" ON "user_favourite_product" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_favourite_product_product_id_idx" ON "user_favourite_product" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "user_favourite_product_created_at_idx" ON "user_favourite_product" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_rating_rater_seller_unique" ON "seller_rating" USING btree ("rater_user_id","seller_user_id");--> statement-breakpoint
CREATE INDEX "seller_rating_rater_user_id_idx" ON "seller_rating" USING btree ("rater_user_id");--> statement-breakpoint
CREATE INDEX "seller_rating_seller_user_id_idx" ON "seller_rating" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX "seller_rating_score_idx" ON "seller_rating" USING btree ("score");--> statement-breakpoint
CREATE INDEX "seller_rating_created_at_idx" ON "seller_rating" USING btree ("created_at");
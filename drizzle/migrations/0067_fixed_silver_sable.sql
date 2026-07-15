CREATE TYPE "public"."app_content_section_name" AS ENUM('about_us', 'follow_us', 'help_support');--> statement-breakpoint
CREATE TABLE "app_content_section" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section" "app_content_section_name" NOT NULL,
	"draft_content" jsonb NOT NULL,
	"published_content" jsonb,
	"has_unpublished_changes" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by_name" text,
	"published_at" timestamp,
	"published_by_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_content_section_section_unique" UNIQUE("section")
);
--> statement-breakpoint
CREATE TABLE "user_bookmark_news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"news_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_bookmark_article" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"article_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_bookmark_news" ADD CONSTRAINT "user_bookmark_news_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bookmark_news" ADD CONSTRAINT "user_bookmark_news_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bookmark_article" ADD CONSTRAINT "user_bookmark_article_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bookmark_article" ADD CONSTRAINT "user_bookmark_article_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_bookmark_news_user_news_unique" ON "user_bookmark_news" USING btree ("user_id","news_id");--> statement-breakpoint
CREATE INDEX "user_bookmark_news_user_id_idx" ON "user_bookmark_news" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_bookmark_news_news_id_idx" ON "user_bookmark_news" USING btree ("news_id");--> statement-breakpoint
CREATE INDEX "user_bookmark_news_created_at_idx" ON "user_bookmark_news" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_bookmark_article_user_article_unique" ON "user_bookmark_article" USING btree ("user_id","article_id");--> statement-breakpoint
CREATE INDEX "user_bookmark_article_user_id_idx" ON "user_bookmark_article" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_bookmark_article_article_id_idx" ON "user_bookmark_article" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "user_bookmark_article_created_at_idx" ON "user_bookmark_article" USING btree ("created_at");
DROP INDEX "product_isPromotion_idx";--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "author" text DEFAULT 'Gem X Newsroom' NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "category" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "cover_image" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "category" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "cover_image" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" DROP COLUMN "is_promotion";--> statement-breakpoint
ALTER TABLE "product" DROP COLUMN "promotion_compare_price";
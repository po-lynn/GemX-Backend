ALTER TABLE "articles" ADD COLUMN "language" text DEFAULT 'English' NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "title_en" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "title_my" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "title_th" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "title_ko" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "content_en" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "content_my" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "content_th" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "content_ko" text;
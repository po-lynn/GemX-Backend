ALTER TABLE "news" ADD COLUMN "language" text DEFAULT 'English' NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "title_en" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "title_my" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "title_th" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "title_ko" text;
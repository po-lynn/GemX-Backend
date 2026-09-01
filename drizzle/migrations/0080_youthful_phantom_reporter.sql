ALTER TABLE "product" ADD COLUMN "language" text DEFAULT 'English' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "description_en" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "description_my" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "description_th" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "description_ko" text;
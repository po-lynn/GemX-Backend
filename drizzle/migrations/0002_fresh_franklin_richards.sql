ALTER TABLE "laboratory" ADD COLUMN "address" text NOT NULL;--> statement-breakpoint
ALTER TABLE "laboratory" ADD COLUMN "phone" text NOT NULL;--> statement-breakpoint
ALTER TABLE "laboratory" DROP COLUMN "country";
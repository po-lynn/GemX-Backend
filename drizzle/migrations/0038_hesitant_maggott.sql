CREATE TYPE "public"."message_type" AS ENUM('text', 'image', 'audio', 'file');--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"content" text NOT NULL,
	"file_url" text,
	"message_type" "message_type" DEFAULT 'text' NOT NULL,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "news_translation" CASCADE;--> statement-breakpoint
CREATE INDEX "chat_idx" ON "messages" USING btree ("sender_id","recipient_id");--> statement-breakpoint
ALTER TABLE "news" DROP COLUMN "language";
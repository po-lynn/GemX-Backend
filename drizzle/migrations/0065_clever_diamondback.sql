DROP INDEX "chat_idx";--> statement-breakpoint
UPDATE "messages" SET "is_read" = false WHERE "is_read" IS NULL;--> statement-breakpoint
UPDATE "messages" SET "starred" = false WHERE "starred" IS NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "is_read" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "starred" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "recipient_chat_idx" ON "messages" USING btree ("recipient_id","sender_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "unread_by_recipient_idx" ON "messages" USING btree ("recipient_id","sender_id") WHERE "messages"."is_read" = false;--> statement-breakpoint
CREATE INDEX "chat_idx" ON "messages" USING btree ("sender_id","recipient_id","created_at" DESC NULLS LAST);
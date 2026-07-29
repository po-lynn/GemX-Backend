CREATE TABLE "contact_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "contact_message_created_at_idx" ON "contact_message" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contact_message_status_idx" ON "contact_message" USING btree ("status");
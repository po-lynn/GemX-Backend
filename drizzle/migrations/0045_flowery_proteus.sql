CREATE TABLE "point_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"direction" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text NOT NULL,
	"reference_id" text,
	"reference_type" text,
	"description" text,
	"payment_method" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "points_lifetime" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "points_reserved" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "point_purchase_request" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "point_transaction" ADD CONSTRAINT "point_transaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pt_userId_idx" ON "point_transaction" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pt_userId_type_idx" ON "point_transaction" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "pt_userId_status_idx" ON "point_transaction" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "pt_userId_createdAt_idx" ON "point_transaction" USING btree ("user_id","created_at");
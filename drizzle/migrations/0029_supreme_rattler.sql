CREATE TABLE "collector_piece_show_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"user_info_json" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collector_piece_show_request" ADD CONSTRAINT "collector_piece_show_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collector_piece_show_request" ADD CONSTRAINT "collector_piece_show_request_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collector_piece_show_request_user_id_idx" ON "collector_piece_show_request" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collector_piece_show_request_product_id_idx" ON "collector_piece_show_request" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "collector_piece_show_request_created_at_idx" ON "collector_piece_show_request" USING btree ("created_at");
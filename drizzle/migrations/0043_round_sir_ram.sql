CREATE TABLE "user_active_chat_view" (
	"user_id" text PRIMARY KEY NOT NULL,
	"peer_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_active_chat_view" ADD CONSTRAINT "user_active_chat_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
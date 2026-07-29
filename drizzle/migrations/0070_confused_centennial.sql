CREATE TABLE "admin_chat_cursor" (
	"user_id" text PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);

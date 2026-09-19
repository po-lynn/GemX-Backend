CREATE TABLE "chat_block" (
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_block_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
ALTER TABLE "chat_block" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_block" ADD CONSTRAINT "chat_block_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_block" ADD CONSTRAINT "chat_block_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_block_blocked_idx" ON "chat_block" USING btree ("blocked_id");
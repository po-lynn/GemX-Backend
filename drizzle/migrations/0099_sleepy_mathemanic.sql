CREATE TYPE "public"."staff_role_type" AS ENUM('escrow_agent', 'moderator', 'support', 'analyst');--> statement-breakpoint
CREATE TYPE "public"."escrow_case_message_kind" AS ENUM('message', 'system');--> statement-breakpoint
CREATE TYPE "public"."escrow_case_message_visibility" AS ENUM('case', 'agent_buyer', 'agent_seller');--> statement-breakpoint
CREATE TYPE "public"."escrow_case_state" AS ENUM('requested', 'agent_assigned', 'verification', 'payment_pending', 'handover_scheduled', 'handover_confirmed', 'completed', 'cancelled', 'rejected', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."escrow_case_system_event_type" AS ENUM('case_created', 'state_changed', 'assigned', 'reassigned');--> statement-breakpoint
CREATE TYPE "public"."escrow_chat_audit_action" AS ENUM('thread_viewed', 'side_channel_message_sent', 'case_assigned', 'case_reassigned', 'state_changed', 'report_dismissed', 'report_actioned', 'user_muted', 'user_banned', 'user_restriction_lifted');--> statement-breakpoint
CREATE TYPE "public"."escrow_chat_audit_target" AS ENUM('escrow_case', 'flat_message', 'case_message', 'user', 'report');--> statement-breakpoint
CREATE TYPE "public"."message_report_resolution" AS ENUM('dismiss', 'warn', 'delete_message', 'mute_user', 'ban_user');--> statement-breakpoint
CREATE TYPE "public"."message_report_status" AS ENUM('open', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."messaging_restriction_type" AS ENUM('mute', 'ban');--> statement-breakpoint
CREATE TABLE "staff_role" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" "staff_role_type" NOT NULL,
	"is_supervisor" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_role" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "escrow_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"assigned_agent_id" text,
	"state" "escrow_case_state" DEFAULT 'requested' NOT NULL,
	"state_entered_at" timestamp DEFAULT now() NOT NULL,
	"agreed_price_minor" bigint NOT NULL,
	"currency" "currency" NOT NULL,
	"fee_bps" integer NOT NULL,
	"buyer_fee_share_bps" integer DEFAULT 5000 NOT NULL,
	"seller_fee_share_bps" integer DEFAULT 5000 NOT NULL,
	"fee_min_minor" bigint,
	"fee_cap_minor" bigint,
	"next_action_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "escrow_case" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "escrow_case_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"message_id" uuid,
	"uploaded_by_user_id" text,
	"url" text NOT NULL,
	"file_type" "message_type" NOT NULL,
	"label" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "escrow_case_attachment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "escrow_case_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"sender_id" text,
	"kind" "escrow_case_message_kind" DEFAULT 'message' NOT NULL,
	"visibility" "escrow_case_message_visibility" DEFAULT 'case' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"file_url" text,
	"image_urls" jsonb,
	"attachment_type" "message_type" DEFAULT 'text' NOT NULL,
	"system_event_type" "escrow_case_system_event_type",
	"system_event_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "escrow_case_message" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "escrow_case_read_cursor" (
	"case_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "escrow_case_read_cursor_case_id_user_id_pk" PRIMARY KEY("case_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "escrow_case_read_cursor" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "escrow_canned_response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body_en" text NOT NULL,
	"body_my" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by_admin_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "escrow_canned_response" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "escrow_chat_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"action_type" "escrow_chat_audit_action" NOT NULL,
	"target_type" "escrow_chat_audit_target" NOT NULL,
	"target_id" text NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "escrow_chat_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "message_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flat_message_id" uuid,
	"case_message_id" uuid,
	"reporter_id" text,
	"reason" text NOT NULL,
	"content_snapshot" text NOT NULL,
	"status" "message_report_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_admin_id" text,
	"resolution_action" "message_report_resolution",
	"resolution_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "message_report_exactly_one_target" CHECK (("message_report"."flat_message_id" IS NOT NULL) <> ("message_report"."case_message_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "message_report" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "messaging_restriction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"restriction_type" "messaging_restriction_type" NOT NULL,
	"reason" text NOT NULL,
	"issued_by_admin_id" text,
	"starts_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"lifted_at" timestamp,
	"lifted_by_admin_id" text,
	"lift_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messaging_restriction" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "escrow_service_setting" ADD COLUMN "buyer_fee_share_bps" integer DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE "escrow_service_setting" ADD COLUMN "seller_fee_share_bps" integer DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE "escrow_service_setting" ADD COLUMN "fee_min_minor" bigint;--> statement-breakpoint
ALTER TABLE "escrow_service_setting" ADD COLUMN "fee_cap_minor" bigint;--> statement-breakpoint
ALTER TABLE "staff_role" ADD CONSTRAINT "staff_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_case" ADD CONSTRAINT "escrow_case_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_case" ADD CONSTRAINT "escrow_case_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_case" ADD CONSTRAINT "escrow_case_listing_id_product_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_case" ADD CONSTRAINT "escrow_case_assigned_agent_id_user_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_case_attachment" ADD CONSTRAINT "escrow_case_attachment_case_id_escrow_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."escrow_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_case_attachment" ADD CONSTRAINT "escrow_case_attachment_message_id_escrow_case_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."escrow_case_message"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_case_attachment" ADD CONSTRAINT "escrow_case_attachment_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_case_message" ADD CONSTRAINT "escrow_case_message_case_id_escrow_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."escrow_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_case_message" ADD CONSTRAINT "escrow_case_message_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_case_read_cursor" ADD CONSTRAINT "escrow_case_read_cursor_case_id_escrow_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."escrow_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_case_read_cursor" ADD CONSTRAINT "escrow_case_read_cursor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_canned_response" ADD CONSTRAINT "escrow_canned_response_created_by_admin_id_user_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_chat_audit_log" ADD CONSTRAINT "escrow_chat_audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_report" ADD CONSTRAINT "message_report_flat_message_id_messages_id_fk" FOREIGN KEY ("flat_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_report" ADD CONSTRAINT "message_report_case_message_id_escrow_case_message_id_fk" FOREIGN KEY ("case_message_id") REFERENCES "public"."escrow_case_message"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_report" ADD CONSTRAINT "message_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_report" ADD CONSTRAINT "message_report_resolved_by_admin_id_user_id_fk" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_restriction" ADD CONSTRAINT "messaging_restriction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_restriction" ADD CONSTRAINT "messaging_restriction_issued_by_admin_id_user_id_fk" FOREIGN KEY ("issued_by_admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_restriction" ADD CONSTRAINT "messaging_restriction_lifted_by_admin_id_user_id_fk" FOREIGN KEY ("lifted_by_admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "escrow_case_assigned_agent_state_idx" ON "escrow_case" USING btree ("assigned_agent_id","state");--> statement-breakpoint
CREATE INDEX "escrow_case_buyer_idx" ON "escrow_case" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "escrow_case_seller_idx" ON "escrow_case" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "escrow_case_listing_idx" ON "escrow_case" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "escrow_case_state_entered_at_idx" ON "escrow_case" USING btree ("state_entered_at");--> statement-breakpoint
CREATE INDEX "escrow_case_attachment_case_idx" ON "escrow_case_attachment" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "escrow_case_attachment_message_idx" ON "escrow_case_attachment" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "escrow_case_message_case_created_idx" ON "escrow_case_message" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "escrow_case_message_case_visibility_idx" ON "escrow_case_message" USING btree ("case_id","visibility");--> statement-breakpoint
CREATE INDEX "escrow_case_message_sender_idx" ON "escrow_case_message" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "escrow_chat_audit_log_target_idx" ON "escrow_chat_audit_log" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "escrow_chat_audit_log_actor_idx" ON "escrow_chat_audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "escrow_chat_audit_log_action_idx" ON "escrow_chat_audit_log" USING btree ("action_type","created_at");--> statement-breakpoint
CREATE INDEX "message_report_status_idx" ON "message_report" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "message_report_flat_message_idx" ON "message_report" USING btree ("flat_message_id");--> statement-breakpoint
CREATE INDEX "message_report_case_message_idx" ON "message_report" USING btree ("case_message_id");--> statement-breakpoint
CREATE INDEX "messaging_restriction_user_active_idx" ON "messaging_restriction" USING btree ("user_id","created_at") WHERE "messaging_restriction"."lifted_at" IS NULL;
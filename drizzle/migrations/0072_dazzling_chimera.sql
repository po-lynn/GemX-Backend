ALTER TABLE "seller_archive" DROP CONSTRAINT "seller_archive_archived_by_admin_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "seller_reputation_action" DROP CONSTRAINT "seller_reputation_action_admin_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "seller_archive" ALTER COLUMN "archived_by_admin_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_reputation_action" ALTER COLUMN "admin_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_archive" ADD CONSTRAINT "seller_archive_archived_by_admin_id_user_id_fk" FOREIGN KEY ("archived_by_admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_reputation_action" ADD CONSTRAINT "seller_reputation_action_admin_user_id_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
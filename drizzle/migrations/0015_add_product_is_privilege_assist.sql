ALTER TABLE "product" ADD COLUMN "is_privilege_assist" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_isPrivilegeAssist_idx" ON "product" USING btree ("is_privilege_assist");

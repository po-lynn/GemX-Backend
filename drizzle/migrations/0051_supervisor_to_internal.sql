ALTER TYPE "public"."user_role" RENAME VALUE 'supervisor' TO 'internal';--> statement-breakpoint
ALTER TABLE "supervisor_permission" RENAME TO "internal_permission";

-- Migrate supervisor_permission from global (feature_key PK) to per-user (user_id + feature_key PK).
-- Existing global rows are dropped — permissions must now be set per supervisor via the user edit form.
DROP TABLE "supervisor_permission";--> statement-breakpoint
CREATE TABLE "supervisor_permission" (
  "user_id" text NOT NULL,
  "feature_key" text NOT NULL,
  "can_access" boolean NOT NULL DEFAULT false,
  CONSTRAINT "supervisor_permission_user_id_feature_key_pk" PRIMARY KEY("user_id","feature_key")
);

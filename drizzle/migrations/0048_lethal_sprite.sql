CREATE TABLE "supervisor_permission" (
	"feature_key" text PRIMARY KEY NOT NULL,
	"can_access" boolean DEFAULT false NOT NULL
);

CREATE TABLE "user_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"fcm_token" text NOT NULL,
	"platform" text,
	"device_id" text,
	"device_name" text,
	"device_model" text,
	"os_version" text,
	"app_version" text,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_devices_user_fcm_token_idx" ON "user_devices" USING btree ("user_id","fcm_token");--> statement-breakpoint
CREATE UNIQUE INDEX "user_devices_fcm_token_idx" ON "user_devices" USING btree ("fcm_token");
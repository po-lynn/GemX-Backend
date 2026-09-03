-- Surprise Bonus: campaigns, DB job queue, in-app notifications, idempotent ledger
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "surprise_bonus_campaign" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "points_per_user" integer NOT NULL,
  "recipient_type" text DEFAULT 'all_users' NOT NULL,
  "note" text,
  "total_users" integer DEFAULT 0 NOT NULL,
  "processed_users" integer DEFAULT 0 NOT NULL,
  "success_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_by" text,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "surprise_bonus_campaign" ADD CONSTRAINT "surprise_bonus_campaign_created_by_user_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sbc_status_idx" ON "surprise_bonus_campaign" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sbc_createdAt_idx" ON "surprise_bonus_campaign" USING btree ("created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "background_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "available_at" timestamp DEFAULT now() NOT NULL,
  "locked_at" timestamp,
  "locked_by" text,
  "last_error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "bj_status_available_idx" ON "background_jobs" USING btree ("status","available_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bj_type_status_idx" ON "background_jobs" USING btree ("type","status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "app_notification" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "data" jsonb,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "app_notification" ADD CONSTRAINT "app_notification_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "an_userId_createdAt_idx" ON "app_notification" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "an_userId_isRead_idx" ON "app_notification" USING btree ("user_id","is_read");
--> statement-breakpoint

-- One user + one campaign (type + reference_id) = one reward
CREATE UNIQUE INDEX IF NOT EXISTS "pt_user_type_ref_uidx"
  ON "point_transaction" ("user_id", "type", "reference_id")
  WHERE "reference_id" IS NOT NULL;
--> statement-breakpoint

-- Claim one pending job safely (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION claim_background_job(p_type text, p_locked_by text)
RETURNS SETOF background_jobs
LANGUAGE plpgsql
AS $$
DECLARE
  v_id text;
BEGIN
  SELECT j.id INTO v_id
  FROM background_jobs j
  WHERE j.type = p_type
    AND j.status = 'pending'
    AND j.available_at <= now()
  ORDER BY j.available_at ASC, j.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE background_jobs
  SET
    status = 'processing',
    attempts = attempts + 1,
    locked_at = now(),
    locked_by = p_locked_by,
    last_error = NULL
  WHERE id = v_id
  RETURNING *;
END;
$$;
--> statement-breakpoint

-- Grant surprise bonus to one user atomically (idempotent via unique index)
CREATE OR REPLACE FUNCTION grant_surprise_bonus_user(p_campaign_id text, p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_points integer;
  v_name text;
  v_created_by text;
  v_tx_id text;
BEGIN
  SELECT points_per_user, name, created_by
  INTO v_points, v_name, v_created_by
  FROM surprise_bonus_campaign
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF v_points IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'campaign_not_found');
  END IF;

  BEGIN
    v_tx_id := gen_random_uuid()::text;
    INSERT INTO point_transaction (
      id, user_id, type, direction, amount, status,
      reference_id, reference_type, description, created_by, created_at
    ) VALUES (
      v_tx_id,
      p_user_id,
      'surprise_bonus',
      'credit',
      v_points,
      'completed',
      p_campaign_id,
      'surprise_bonus_campaign',
      'Surprise bonus: ' || v_name,
      v_created_by,
      now()
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already_granted');
  END;

  UPDATE "user"
  SET
    points = points + v_points,
    points_lifetime = points_lifetime + v_points
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    -- Rollback ledger if user vanished mid-flight
    DELETE FROM point_transaction WHERE id = v_tx_id;
    RETURN jsonb_build_object('granted', false, 'reason', 'user_not_found');
  END IF;

  INSERT INTO app_notification (
    id, user_id, type, title, message, data, is_read, created_at
  ) VALUES (
    gen_random_uuid()::text,
    p_user_id,
    'surprise_bonus',
    v_name || ' 🎁',
    'You received ' || v_points::text || ' surprise bonus points!',
    jsonb_build_object('campaignId', p_campaign_id),
    false,
    now()
  );

  RETURN jsonb_build_object('granted', true, 'points', v_points);
END;
$$;
--> statement-breakpoint

-- Supabase only: service_role exists on hosted Postgres, not on local dev DB
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION claim_background_job(text, text) TO service_role;
    GRANT EXECUTE ON FUNCTION grant_surprise_bonus_user(text, text) TO service_role;
  END IF;
END $$;

-- Create user_devices table for FCM push + device tracking.
-- Run: psql $DATABASE_URL -f scripts/create-user-devices-table.sql
-- Then optionally: psql $DATABASE_URL -f scripts/migrate-push-device-token-to-user-devices.sql

CREATE TABLE IF NOT EXISTS user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  fcm_token text NOT NULL,
  platform text,
  device_id text,
  device_name text,
  device_model text,
  os_version text,
  app_version text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_devices_user_fcm_token_idx
  ON user_devices (user_id, fcm_token);

CREATE UNIQUE INDEX IF NOT EXISTS user_devices_fcm_token_idx
  ON user_devices (fcm_token);

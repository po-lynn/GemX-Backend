-- One-time migration: copy legacy push_device_token rows into user_devices.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).

INSERT INTO user_devices (
  user_id,
  fcm_token,
  platform,
  last_active_at,
  created_at,
  updated_at
)
SELECT
  user_id,
  token,
  platform,
  COALESCE(updated_at, created_at, NOW()),
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW())
FROM push_device_token
ON CONFLICT (fcm_token) DO NOTHING;

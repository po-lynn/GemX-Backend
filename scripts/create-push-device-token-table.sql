-- Create push_device_token table for FCM device tokens (mobile app push notifications).
-- Run once if the table is missing: Supabase Dashboard → SQL Editor → paste → Run.
-- Or run: npm run db:push (which applies all Drizzle schema including this table).

CREATE TABLE IF NOT EXISTS push_device_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS push_device_token_user_token_idx
  ON push_device_token (user_id, token);

-- Optional: trigger to keep updated_at in sync (match Drizzle $onUpdate behavior)
CREATE OR REPLACE FUNCTION push_device_token_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS push_device_token_updated_at ON push_device_token;
CREATE TRIGGER push_device_token_updated_at
  BEFORE UPDATE ON push_device_token
  FOR EACH ROW EXECUTE PROCEDURE push_device_token_updated_at();

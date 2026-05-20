-- Active chat view tracking (suppresses push when user is in the conversation).
CREATE TABLE IF NOT EXISTS user_active_chat_view (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  peer_id text NOT NULL,
  conversation_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

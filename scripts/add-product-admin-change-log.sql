-- Admin product form: append-only log when listing status or price changes (run on Postgres / Supabase).

CREATE TYPE product_admin_change_type AS ENUM ('status', 'price');

CREATE TABLE product_admin_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  change_type product_admin_change_type NOT NULL,
  old_value text NOT NULL,
  new_value text NOT NULL,
  actor_id text REFERENCES "user"(id) ON DELETE SET NULL
);

CREATE INDEX product_admin_change_log_productId_idx ON product_admin_change_log (product_id);
CREATE INDEX product_admin_change_log_createdAt_idx ON product_admin_change_log (created_at);

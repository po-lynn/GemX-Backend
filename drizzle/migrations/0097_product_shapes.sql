-- Admin-managed product shape lookup (avoids clash with enum type "product_shape")
CREATE TABLE IF NOT EXISTS "product_shapes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Seed existing enum values so the admin list starts populated
INSERT INTO "product_shapes" ("name")
SELECT v FROM (VALUES
  ('Oval'),
  ('Cushion'),
  ('Mixed Cushion'),
  ('Star'),
  ('Round'),
  ('Pear'),
  ('Heart')
) AS t(v)
WHERE NOT EXISTS (
  SELECT 1 FROM "product_shapes" ps WHERE ps."name" = t.v
);

-- IF NOT EXISTS: 0097_product_shapes.sql already creates this exact table (an
-- orphaned-migration duplicate, same pattern as 0080/0083/0088/0089). Without the
-- guard, drizzle-kit's single-transaction batch migrate aborts here with "relation
-- already exists" and rolls back everything after it, including 0099's
-- escrow_chat_audit_log — which is why that table was never created on production.
CREATE TABLE IF NOT EXISTS "product_shapes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "product" ADD COLUMN "is_collector_piece" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_isCollectorPiece_idx" ON "product" USING btree ("is_collector_piece");

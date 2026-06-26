ALTER TABLE "product" ADD COLUMN "is_promotion" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "promotion_compare_price" numeric(14, 2);--> statement-breakpoint
CREATE INDEX "product_isPromotion_idx" ON "product" USING btree ("is_promotion");
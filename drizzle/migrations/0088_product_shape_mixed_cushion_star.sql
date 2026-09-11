-- Add Mixed Cushion and Star to product_shape enum
ALTER TYPE "public"."product_shape" ADD VALUE IF NOT EXISTS 'Mixed Cushion';
--> statement-breakpoint
ALTER TYPE "public"."product_shape" ADD VALUE IF NOT EXISTS 'Star';

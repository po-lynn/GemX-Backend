-- App Content: Buying Guide + Selling Guide sections (BlockNote multilang JSON)
ALTER TYPE "public"."app_content_section_name" ADD VALUE IF NOT EXISTS 'buying_guide';
--> statement-breakpoint
ALTER TYPE "public"."app_content_section_name" ADD VALUE IF NOT EXISTS 'selling_guide';

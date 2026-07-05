CREATE TABLE "color" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"hex_code" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "color_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "color_id" uuid;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_color_id_color_id_fk" FOREIGN KEY ("color_id") REFERENCES "public"."color"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_colorId_idx" ON "product" USING btree ("color_id");
--> statement-breakpoint
INSERT INTO "color" ("name", "hex_code") VALUES
('Red', '#D32F2F'),
('Pink', '#E91E63'),
('Blue', '#1565C0'),
('Green', '#2E7D32'),
('Yellow', '#F9A825'),
('Orange', '#EF6C00'),
('Purple', '#6A1B9A'),
('Violet', '#7F00FF'),
('White', '#FFFFFF'),
('Colorless', ''),
('Black', '#000000'),
('Brown', '#6D4C41'),
('Gray', '#9E9E9E'),
('Golden', '#D4AF37'),
('Multi-color', ''),
('Bi-color', ''),
('Padparadscha', '#F88379'),
('Pigeon Blood Red', '#9B111E'),
('Royal Blue', '#002366'),
('Cornflower Blue', '#6495ED')
ON CONFLICT ("name") DO NOTHING;
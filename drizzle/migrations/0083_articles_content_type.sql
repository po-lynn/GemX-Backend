ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'article' NOT NULL;

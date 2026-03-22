-- Add optional certificate / internal notes column (run on Postgres if not using drizzle-kit push)
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS additional_memos text;

-- Normalize Myanmar phone numbers from domestic format (09...) to E.164 (+959...).
-- Run once to fix existing data that was stored before normalization was enforced.
-- Safe: skips any phone where the +959... form already exists on another user.

UPDATE "user"
SET "phone" = '+959' || substring("phone" FROM 2)
WHERE "phone" ~ '^09[0-9]{7,15}$'
  AND NOT EXISTS (
    SELECT 1 FROM "user" u2
    WHERE u2."phone" = '+959' || substring("user"."phone" FROM 2)
      AND u2."id" != "user"."id"
  );

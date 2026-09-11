# Local migrate: Supabase RLS migration (0086)

## Prerequisites

- `DATABASE_URL` pointing at your Postgres (local or Supabase)
- Dependencies installed (`npm install`)

## Symptom

```text
npm run db:migrate
DrizzleQueryError: Failed query: ... REVOKE ALL ... FROM "anon", "authenticated";
cause: PostgresError: role "anon" does not exist
```

## Cause

Migration `0086_stormy_giant_man.sql` targets Supabase PostgREST roles. Plain local Postgres does not create `anon` / `authenticated`.

## Fix

The migration was updated to skip `REVOKE` when those roles are missing, while still enabling RLS. Re-run:

```bash
npm run db:migrate
```

## If you already used `db:push`

`db:push` may have already added enum values / enabled RLS without writing `__drizzle_migrations`. After the 0086 fix, `db:migrate` should still apply pending journal entries; statements that are already true (e.g. `ADD VALUE IF NOT EXISTS`, `ENABLE ROW LEVEL SECURITY`) are safe.

## Extending

When adding more PostgREST lock-down SQL, always guard role-specific grants/revokes:

```sql
IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
END IF;
```

## Common errors

| Error | Fix |
| --- | --- |
| `role "anon" does not exist` | Ensure you have the updated 0086; re-run migrate |
| Enum value already exists | Use `ADD VALUE IF NOT EXISTS` (see 0088) |

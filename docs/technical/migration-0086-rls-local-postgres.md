# Fix: migration 0086 fails locally (`role "anon" does not exist`)

## What changed

`drizzle/migrations/0086_stormy_giant_man.sql` previously ran:

```sql
REVOKE ALL ON TABLE ... FROM "anon", "authenticated";
```

That is correct on **Supabase** (those roles exist for PostgREST). On a **local Postgres** without Supabase roles, Postgres errors with `42704: role "anon" does not exist`, and `npm run db:migrate` aborts before later migrations (including product shape enum updates).

The migration now:

1. Checks `pg_roles` for `anon` / `authenticated`
2. Only `REVOKE`s when those roles exist
3. Still `ENABLE ROW LEVEL SECURITY` on every listed table in all environments

## Data flow

No app runtime change. Drizzle still connects with `DATABASE_URL` (BYPASSRLS / table owner). Supabase REST (`anon` / `authenticated`) remains locked out when those roles exist.

## Schema impact

None beyond what 0086 already intended (RLS enabled, optional revoke). Idempotent `ENABLE ROW LEVEL SECURITY` is safe if `db:push` already applied RLS.

## Auth & permissions

Unchanged: app access via Drizzle / `service_role`; no new policies for `anon`/`authenticated`.

## Edge cases

- If 0086 already applied on Supabase with the old SQL, do not re-run it; local DBs that never applied it will pick up the new body.
- `db:push` can apply shape enum + RLS without recording migrations; prefer `db:migrate` for shared environments so `__drizzle_migrations` stays accurate.

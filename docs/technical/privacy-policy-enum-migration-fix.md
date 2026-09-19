# Privacy Policy Save Failure: Orphaned Enum Migration

## What changed and why

Saving the Privacy Policy document from `/admin/app-content?tab=legal&doc=privacy` on
production failed on every attempt with a Drizzle-wrapped Postgres error on the
`app_content_section` upsert. Direct query against production
(`SUPABASE_SERVICE_ROLE_KEY` + PostgREST) reproduced the underlying error exactly:

```
{"code":"22P02","message":"invalid input value for enum app_content_section_name: \"privacy_policy\""}
```

Root cause: `'privacy_policy'` was added to the `app_content_section_name` Postgres
enum by two migration files, `drizzle/migrations/0095_privacy_policy_section.sql` and
`drizzle/migrations/0096_curious_luke_cage.sql` — but neither is registered in
`drizzle/migrations/meta/_journal.json` (the journal jumps from `idx: 91` straight to
`idx: 97`; `idx` 92–96 have no entries, and files `0092`–`0094` don't exist on disk at
all). `drizzle-kit migrate` (`npm run db:migrate`) applies migrations strictly in
journal order and has therefore never run 0095/0096 anywhere. The current Drizzle
schema (`drizzle/schema/app-content-schema.ts`) has always declared `privacy_policy` as
a valid enum value, and local dev already had it in the live enum (confirmed via
`SELECT enum_range(NULL::app_content_section_name)`), almost certainly added at some
point via `npm run db:push`, which introspects `schema.ts` directly and ignores the
journal entirely. Production, which is only ever migrated via `db:migrate`, never
received it. This is the same class of drift previously seen and worked around for
migrations `0080`/`0081` (see prior session notes) — a merge produced orphaned files
that the journal doesn't reference.

Files touched:

- `drizzle/migrations/0104_privacy_policy_enum_backfill.sql` — new, journal-tracked,
  idempotent (`ADD VALUE IF NOT EXISTS`) migration that adds the missing enum value.
- `drizzle/migrations/meta/_journal.json` — new `idx: 104` entry registering it.
- `tests/unit/migrations-journal-integrity.test.ts` — regression test (see below).

`drizzle/migrations/0095_privacy_policy_section.sql` and `0096_curious_luke_cage.sql`
were left in place, unmodified — they're historical artifacts, not something to
retroactively re-journal. Notably `0096` is **not** idempotent
(`ADD VALUE 'privacy_policy'` with no `IF NOT EXISTS`); registering it as-is would
error out on any environment (like local dev) that already has the value.

## Data flow

`AppContentClient.handleSave()` → `saveAppContentAction()` (server action, not a REST
route) → `saveAppContentDraft()` → `db.transaction()` running
`insert into app_content_section (...) values (..., 'privacy_policy', ...) on conflict
("section") do update set ...`. Postgres validates the `section` enum literal before
anything else in the statement runs (including the `ON CONFLICT` branch), so the
failure occurred immediately on every save attempt, regardless of whether a row already
existed for that section.

## Schema impact

No TypeScript schema change — `appContentSectionEnum` in
`drizzle/schema/app-content-schema.ts` already listed `privacy_policy`; only the
physical production enum type was out of sync with it. New migration:

```sql
ALTER TYPE "public"."app_content_section_name" ADD VALUE IF NOT EXISTS 'privacy_policy';
```

This must be applied to production by running `npm run db:migrate` there — per this
project's workflow, migrations are applied manually and were **not** run as part of
this change.

## Auth & permissions

Unchanged — `saveAppContentAction` still requires `requireActionRole(canManageAppContent)`.

## Edge cases & known limitations

- **The underlying journal-integrity problem is broader than this one enum.** This fix
  addresses the specific `app_content_section_name` drift that broke Privacy Policy
  saves; it does not retroactively audit every other orphaned migration in the repo
  (e.g. the pre-existing `0080`/`0081` case). `tests/unit/migrations-journal-integrity.test.ts`
  only guards `app_content_section_name` going forward.
- **`db:push` masks this class of bug in local dev.** Because `db:push` diffs
  `schema.ts` against the live DB directly, a developer can add an enum value, run
  `db:push` locally, and have everything work — while the journal-tracked migration
  needed for `db:migrate` (used in production) never gets created or gets orphaned by a
  merge. There's no tooling guard against this beyond code review and the new test.
- **New migration must still be run against production manually** (`npm run db:migrate`,
  per project convention) before the Privacy Policy save actually starts working there.

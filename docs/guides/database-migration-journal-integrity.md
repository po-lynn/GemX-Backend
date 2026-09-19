# Guide: keeping migrations and the journal in sync

## Prerequisites

- No new env vars or dependencies. Applies to anyone editing `drizzle/schema/*.ts` in
  this repo.

## Why this matters

`npm run db:migrate` (`drizzle-kit migrate`) only ever applies the migration files
listed in `drizzle/migrations/meta/_journal.json`, strictly in `idx` order. A `.sql`
file sitting in `drizzle/migrations/` with **no** matching `tag` entry in the journal
is invisible to it — it will never run, on any environment, no matter how long it sits
there.

`npm run db:push`, by contrast, diffs your current `schema.ts` directly against
whatever database it's pointed at and applies the difference immediately — it doesn't
read or write the journal at all. This project uses `db:push` for local/dev
convenience but `db:migrate` for production (see project CLAUDE.md — migrations are
applied manually). That split means a schema change can work perfectly in local dev
(via `db:push`) while its migration file quietly never reaches production, because a
merge conflict or generation hiccup left it orphaned from the journal. This exact
scenario broke Privacy Policy saves in production — see
`docs/technical/privacy-policy-enum-migration-fix.md`.

## How to check you haven't orphaned a migration

After running `npm run db:generate`, confirm the new file's tag actually landed in the
journal:

```bash
tail -5 drizzle/migrations/meta/_journal.json
ls drizzle/migrations/ | tail -5
```

The highest `idx` in the journal and the highest-numbered `.sql` file on disk should
describe the same migration. If you see a `.sql` file whose number doesn't appear as a
`tag` anywhere in `_journal.json`'s `entries`, it's orphaned — it needs a journal entry
before it will ever be applied anywhere by `db:migrate`.

`tests/unit/migrations-journal-integrity.test.ts` also runs this check automatically
for every value in `appContentSectionEnum` — extend it (or add a sibling test) if you
add a new enum whose values matter for correctness, following the same
`journalTrackedEnumValues()` pattern.

## Extending it — adding a new enum value safely

1. Add the value to the `pgEnum(...)` array in the relevant `drizzle/schema/*.ts` file.
2. Run `npm run db:generate` and verify it produced a new `.sql` file **and** a new
   entry in `_journal.json` with a matching `tag` (see check above).
3. If you're hand-authoring the SQL instead of generating it (e.g. backfilling a gap
   like this one), always use `ADD VALUE IF NOT EXISTS` for enum additions — it's the
   only way the migration stays safe to run on an environment where the value was
   already added out-of-band (e.g. via `db:push` in local dev).
4. Do not run `db:migrate`/`db:push` yourself against production — hand the file off
   for manual application per this project's workflow.

## Common errors

- **`invalid input value for enum <type>: "<value>"`** (Postgres code `22P02`) at save
  time, for a value you're sure is in `schema.ts`: the schema and the live database
  have drifted. Check whether the migration that adds that value is actually registered
  in `_journal.json` on the environment that's failing — don't assume `db:generate`
  having run once means the file is reachable.
- **A migration errors with "value already exists" when applied**: it was written
  without `IF NOT EXISTS` and is being run against an environment (often local dev via
  `db:push`) that already has the value. Prefer regenerating with `IF NOT EXISTS`
  rather than dropping/recreating the type.

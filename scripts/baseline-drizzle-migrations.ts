/**
 * Baseline Drizzle migration history for a DB that already has the schema
 * (e.g. applied earlier via push / older migrate / prod snapshot) but an empty
 * `drizzle.__drizzle_migrations` table.
 *
 * Without this, `npm run db:migrate` restarts at 0000 and fails with:
 *   type "product_type" already exists
 *
 * Usage:
 *   npx tsx scripts/baseline-drizzle-migrations.ts
 *   npx tsx scripts/baseline-drizzle-migrations.ts --until 0078_dear_smiling_tiger
 *   npm run db:migrate   # applies only newer migrations (e.g. 0079)
 *
 * Env: DATABASE_URL or DIRECT_URL (same as drizzle.config.ts)
 */

import { createHash } from "node:crypto"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { config } from "dotenv"
import postgres from "postgres"

config({ path: ".env.local", override: true })
config({ path: ".env" })

type JournalEntry = {
  idx: number
  version: string
  when: number
  tag: string
  breakpoints: boolean
}

type Journal = {
  entries: JournalEntry[]
}

function parseUntilFlag(argv: string[]): string {
  const i = argv.indexOf("--until")
  if (i >= 0 && argv[i + 1]) return argv[i + 1]!
  return "0078_dear_smiling_tiger"
}

async function main() {
  const untilTag = parseUntilFlag(process.argv.slice(2))
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!url) {
    console.error("Missing DATABASE_URL or DIRECT_URL")
    process.exit(1)
  }

  const migrationsDir = join(process.cwd(), "drizzle/migrations")
  const journalPath = join(migrationsDir, "meta/_journal.json")
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal

  const untilIdx = journal.entries.findIndex((e) => e.tag === untilTag)
  if (untilIdx < 0) {
    console.error(`Unknown --until tag: ${untilTag}`)
    console.error(
      "Known tags:",
      journal.entries.map((e) => e.tag).slice(-10).join(", "),
    )
    process.exit(1)
  }

  const toBaseline = journal.entries.slice(0, untilIdx + 1)
  const sql = postgres(url, { max: 1 })

  try {
    await sql`CREATE SCHEMA IF NOT EXISTS drizzle`
    await sql`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `

    const existing = await sql<{ hash: string; created_at: string }[]>`
      SELECT hash, created_at::text AS created_at
      FROM drizzle.__drizzle_migrations
    `
    const existingHashes = new Set(existing.map((r) => r.hash))
    const maxCreated = existing.reduce(
      (max, r) => Math.max(max, Number(r.created_at) || 0),
      0,
    )

    let inserted = 0
    let skipped = 0

    for (const entry of toBaseline) {
      const filePath = join(migrationsDir, `${entry.tag}.sql`)
      if (!existsSync(filePath)) {
        console.error(`Missing migration file: ${filePath}`)
        process.exit(1)
      }
      const query = readFileSync(filePath, "utf8")
      const hash = createHash("sha256").update(query).digest("hex")

      if (existingHashes.has(hash)) {
        skipped++
        continue
      }

      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${hash}, ${entry.when})
      `
      existingHashes.add(hash)
      inserted++
      console.log(`baselined ${entry.tag}`)
    }

    const untilWhen = toBaseline[toBaseline.length - 1]!.when
    console.log("")
    console.log(`Until tag: ${untilTag} (when=${untilWhen})`)
    console.log(`Inserted: ${inserted}, already present: ${skipped}`)
    console.log(`Previous max created_at in table: ${maxCreated || "(none)"}`)
    console.log("")
    console.log("Next: npm run db:migrate")
    console.log(
      "That will apply only journal entries with when > the last baselined migration.",
    )
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

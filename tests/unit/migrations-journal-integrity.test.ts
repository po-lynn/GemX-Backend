import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { appContentSectionEnum } from "@/drizzle/schema/app-content-schema"

const MIGRATIONS_DIR = path.resolve(__dirname, "../../drizzle/migrations")
const JOURNAL_PATH = path.join(MIGRATIONS_DIR, "meta/_journal.json")

function readMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({ tag: f.replace(/\.sql$/, ""), sql: fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8") }))
}

function readJournalTags(): Set<string> {
  const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8"))
  return new Set(journal.entries.map((e: { tag: string }) => e.tag))
}

// Enum values reachable via `drizzle-kit migrate` (journal-tracked files only) —
// this is what actually gets applied to a database, unlike orphaned files on disk.
function journalTrackedEnumValues(enumTypeName: string): Set<string> {
  const journalTags = readJournalTags()
  const values = new Set<string>()
  for (const { tag, sql } of readMigrationFiles()) {
    if (!journalTags.has(tag)) continue
    const createMatch = sql.match(
      new RegExp(`CREATE TYPE "public"\\."${enumTypeName}"[^(]*\\(([^)]*)\\)`),
    )
    if (createMatch) {
      for (const v of createMatch[1].matchAll(/'([^']+)'/g)) values.add(v[1])
    }
    const addValueRegex = new RegExp(`ALTER TYPE "public"\\."${enumTypeName}" ADD VALUE[^']*'([^']+)'`, "g")
    for (const v of sql.matchAll(addValueRegex)) values.add(v[1])
  }
  return values
}

describe("migrations journal integrity", () => {
  // Regression test for the privacy_policy save bug: migrations 0095/0096 added
  // 'privacy_policy' to app_content_section_name but were never registered in
  // meta/_journal.json, so `drizzle-kit migrate` silently never applied them in
  // production while the enum value already existed in schema.ts and local dev
  // (added there via db:push, bypassing the journal). Fails if a future enum
  // value is ever declared in the schema without reaching a journal-tracked migration.
  it("every app_content_section_name enum value reaches the database via a journal-tracked migration", () => {
    const trackedValues = journalTrackedEnumValues("app_content_section_name")
    for (const value of appContentSectionEnum.enumValues) {
      expect(trackedValues.has(value)).toBe(true)
    }
  })

  // Every journal entry must point at a file that actually exists, or
  // `drizzle-kit migrate` fails outright when it tries to apply it.
  it("every journal entry has a corresponding migration file on disk", () => {
    const journalTags = readJournalTags()
    const onDiskTags = new Set(readMigrationFiles().map((f) => f.tag))
    for (const tag of journalTags) {
      expect(onDiskTags.has(tag)).toBe(true)
    }
  })
})

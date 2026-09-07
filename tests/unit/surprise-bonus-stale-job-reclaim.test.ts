import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Validates the fix for jobs stranded in "processing" forever when a serverless
// function is killed mid-batch (e.g. Vercel maxDuration timeout): claim_background_job
// must also reclaim stale "processing" rows, not just "pending" ones, or a killed
// batch becomes invisible to every future claim (after() retry or Vercel Cron).
const MIGRATION_PATH = join(
  process.cwd(),
  "drizzle/migrations/0087_reclaim_stale_surprise_bonus_jobs.sql",
)
const MANUAL_RPC_PATH = join(process.cwd(), "scripts/surprise-bonus-rpcs.sql")

describe("claim_background_job stale-processing reclaim", () => {
  it("migration reclaims processing jobs whose lock is stale, alongside pending jobs", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8")
    expect(sql).toContain("CREATE OR REPLACE FUNCTION claim_background_job")
    expect(sql).toMatch(/status = 'pending'\s+AND j\.available_at <= now\(\)/)
    expect(sql).toMatch(/status = 'processing'\s+AND j\.locked_at < now\(\) - interval/)
  })

  it("manual Supabase SQL editor copy matches the same reclaim condition", () => {
    const sql = readFileSync(MANUAL_RPC_PATH, "utf8")
    expect(sql).toMatch(/status = 'processing'\s+AND j\.locked_at < now\(\) - interval '3 minutes'/)
  })
})

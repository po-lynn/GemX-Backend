import { describe, expect, it } from "vitest"
import { shouldSyncProcessSurpriseBonus } from "@/features/points/services/should-sync-process-surprise-bonus"

describe("shouldSyncProcessSurpriseBonus", () => {
  it("defaults to true outside production when flag unset", () => {
    // Local/dev should credit users without waiting for Supabase Cron
    expect(
      shouldSyncProcessSurpriseBonus({ NODE_ENV: "development" }),
    ).toBe(true)
  })

  it("defaults to false in production when flag unset", () => {
    expect(
      shouldSyncProcessSurpriseBonus({ NODE_ENV: "production" }),
    ).toBe(false)
  })

  it("honors SURPRISE_BONUS_SYNC_PROCESS=true in production", () => {
    expect(
      shouldSyncProcessSurpriseBonus({
        NODE_ENV: "production",
        SURPRISE_BONUS_SYNC_PROCESS: "true",
      }),
    ).toBe(true)
  })

  it("honors SURPRISE_BONUS_SYNC_PROCESS=false in development", () => {
    expect(
      shouldSyncProcessSurpriseBonus({
        NODE_ENV: "development",
        SURPRISE_BONUS_SYNC_PROCESS: "false",
      }),
    ).toBe(false)
  })
})

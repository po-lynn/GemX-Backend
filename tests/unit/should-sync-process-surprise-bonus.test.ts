import { describe, expect, it } from "vitest"
import { shouldSyncProcessSurpriseBonus } from "@/features/points/services/should-sync-process-surprise-bonus"

describe("shouldSyncProcessSurpriseBonus", () => {
  // Validates: default is inline everywhere so Vercel Top-up does not stick on processing.
  it("defaults to true when flag unset (including production)", () => {
    expect(
      shouldSyncProcessSurpriseBonus({ NODE_ENV: "development" }),
    ).toBe(true)
    expect(
      shouldSyncProcessSurpriseBonus({ NODE_ENV: "production" }),
    ).toBe(true)
  })

  it("honors SURPRISE_BONUS_SYNC_PROCESS=true", () => {
    expect(
      shouldSyncProcessSurpriseBonus({
        NODE_ENV: "production",
        SURPRISE_BONUS_SYNC_PROCESS: "true",
      }),
    ).toBe(true)
  })

  // Validates: explicit false opts into after()+cron only (no inline drain).
  it("honors SURPRISE_BONUS_SYNC_PROCESS=false", () => {
    expect(
      shouldSyncProcessSurpriseBonus({
        NODE_ENV: "development",
        SURPRISE_BONUS_SYNC_PROCESS: "false",
      }),
    ).toBe(false)
    expect(
      shouldSyncProcessSurpriseBonus({
        NODE_ENV: "production",
        SURPRISE_BONUS_SYNC_PROCESS: "false",
      }),
    ).toBe(false)
  })
})

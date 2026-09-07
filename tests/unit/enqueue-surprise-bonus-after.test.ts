import { beforeEach, describe, expect, it, vi } from "vitest"

const afterMock = vi.fn((fn: () => void) => {
  // Do not run callbacks by default — async path schedules work after the response.
  void fn
})

vi.mock("next/server", () => ({
  after: (fn: () => void) => afterMock(fn),
}))

vi.mock("@/features/points/db/surprise-bonus", () => ({
  countActiveUsers: vi.fn(),
  createSurpriseBonusCampaign: vi.fn(),
  enqueueSurpriseBonusBatchJob: vi.fn(),
  markSurpriseBonusCampaignProcessing: vi.fn(),
}))

vi.mock("@/features/points/services/process-surprise-bonus-jobs", () => ({
  drainSurpriseBonusJobs: vi.fn(),
}))

vi.mock("@/features/points/services/should-sync-process-surprise-bonus", () => ({
  shouldSyncProcessSurpriseBonus: vi.fn(),
}))

import {
  countActiveUsers,
  createSurpriseBonusCampaign,
  enqueueSurpriseBonusBatchJob,
  markSurpriseBonusCampaignProcessing,
} from "@/features/points/db/surprise-bonus"
import { drainSurpriseBonusJobs } from "@/features/points/services/process-surprise-bonus-jobs"
import { shouldSyncProcessSurpriseBonus } from "@/features/points/services/should-sync-process-surprise-bonus"
import { enqueueSurpriseBonusForAllUsers } from "@/features/points/services/enqueue-surprise-bonus"

describe("enqueueSurpriseBonusForAllUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("CRON_SECRET", "")
    vi.stubEnv("AUTH_URL", "")
    vi.stubEnv("VERCEL_URL", "")
    vi.mocked(countActiveUsers).mockResolvedValue(250)
    vi.mocked(createSurpriseBonusCampaign).mockResolvedValue({
      id: "camp-1",
      name: "Promo",
      pointsPerUser: 10,
      recipientType: "all_users",
      note: null,
      totalUsers: 250,
      processedUsers: 0,
      successCount: 0,
      failedCount: 0,
      status: "pending",
      createdBy: "admin-1",
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(enqueueSurpriseBonusBatchJob).mockResolvedValue({ id: "job-1" })
    vi.mocked(markSurpriseBonusCampaignProcessing).mockResolvedValue(undefined as never)
    vi.mocked(drainSurpriseBonusJobs).mockResolvedValue({ batches: 3 })
  })

  // Validates: SURPRISE_BONUS_SYNC_PROCESS=false schedules after() drain (no inline).
  it("schedules after() drain when sync process is disabled", async () => {
    vi.mocked(shouldSyncProcessSurpriseBonus).mockReturnValue(false)

    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "Promo",
      pointsPerUser: 10,
      createdBy: "admin-1",
    })

    expect(result).toMatchObject({
      success: true,
      processedInline: false,
      scheduledAfterResponse: true,
    })
    expect(drainSurpriseBonusJobs).not.toHaveBeenCalled()
    expect(afterMock).toHaveBeenCalled()

    const scheduled = afterMock.mock.calls[0]![0] as () => void | Promise<void>
    await scheduled()
    expect(drainSurpriseBonusJobs).toHaveBeenCalledWith({ maxBatches: 5 })
  })

  // Validates: default/enabled path credits users before the HTTP response returns.
  it("drains inline when sync process is enabled (Vercel default)", async () => {
    vi.mocked(shouldSyncProcessSurpriseBonus).mockReturnValue(true)

    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "Promo",
      pointsPerUser: 10,
      createdBy: "admin-1",
    })

    expect(result).toMatchObject({
      success: true,
      processedInline: true,
      scheduledAfterResponse: false,
    })
    expect(drainSurpriseBonusJobs).toHaveBeenCalledWith({ maxBatches: 5 })
    expect(afterMock).not.toHaveBeenCalled()
  })

  // Validates: RPC/drain failures surface as an error instead of a fake success stuck on processing.
  it("returns an error when inline drain throws", async () => {
    vi.mocked(shouldSyncProcessSurpriseBonus).mockReturnValue(true)
    vi.mocked(drainSurpriseBonusJobs).mockRejectedValue(new Error("function claim_background_job does not exist"))

    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "Promo",
      pointsPerUser: 10,
      createdBy: "admin-1",
    })

    expect(result).toMatchObject({
      error: expect.stringContaining("crediting failed"),
    })
  })
})

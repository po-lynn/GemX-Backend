import { beforeEach, describe, expect, it, vi } from "vitest"

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
    vi.mocked(createSurpriseBonusCampaign).mockResolvedValue({
      id: "camp-1",
      name: "Sweet December",
      pointsPerUser: 500,
      recipientType: "all_users",
      note: null,
      totalUsers: 2,
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
    vi.mocked(shouldSyncProcessSurpriseBonus).mockReturnValue(false)
    vi.mocked(drainSurpriseBonusJobs).mockResolvedValue({ batches: 0 })
  })

  it("rejects non-positive points", async () => {
    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "Sweet December",
      pointsPerUser: 0,
      createdBy: "admin-1",
    })
    expect(result).toEqual({ error: "Amount must be a positive number." })
  })

  it("rejects empty campaign name", async () => {
    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "  ",
      pointsPerUser: 500,
      createdBy: "admin-1",
    })
    expect(result).toEqual({ error: "Campaign name is required." })
  })

  it("creates campaign and first pending batch job without draining when sync off", async () => {
    vi.mocked(countActiveUsers).mockResolvedValue(1256)

    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "Sweet December",
      pointsPerUser: 500,
      note: "Holiday",
      createdBy: "admin-1",
    })

    expect(result).toEqual({
      success: true,
      campaignId: "camp-1",
      totalUsers: 1256,
      pointsPerUser: 500,
      campaignName: "Sweet December",
      processedInline: false,
    })
    expect(createSurpriseBonusCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Sweet December",
        pointsPerUser: 500,
        totalUsers: 1256,
        createdBy: "admin-1",
      }),
    )
    expect(enqueueSurpriseBonusBatchJob).toHaveBeenCalledWith({
      campaignId: "camp-1",
      lastUserId: null,
    })
    expect(markSurpriseBonusCampaignProcessing).toHaveBeenCalledWith("camp-1")
    expect(drainSurpriseBonusJobs).not.toHaveBeenCalled()
  })

  it("drains jobs inline when sync processing is enabled", async () => {
    // Local/dev path: credits users in the same request via Drizzle RPCs
    vi.mocked(countActiveUsers).mockResolvedValue(250)
    vi.mocked(shouldSyncProcessSurpriseBonus).mockReturnValue(true)
    vi.mocked(drainSurpriseBonusJobs).mockResolvedValue({
      batches: 3,
      last: {
        claimed: true,
        jobId: "job-3",
        campaignId: "camp-1",
        batchSize: 50,
        successDelta: 50,
        failedDelta: 0,
        hasMore: false,
        campaignStatus: "completed",
      },
    })

    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "Sweet December",
      pointsPerUser: 500,
      createdBy: "admin-1",
    })

    expect(result).toMatchObject({
      success: true,
      campaignId: "camp-1",
      processedInline: true,
    })
    expect(drainSurpriseBonusJobs).toHaveBeenCalledWith({ maxBatches: 5 })
  })

  it("returns error when no active users", async () => {
    vi.mocked(countActiveUsers).mockResolvedValue(0)
    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "Sweet December",
      pointsPerUser: 500,
      createdBy: "admin-1",
    })
    expect(result).toEqual({ error: "No active users found." })
  })
})

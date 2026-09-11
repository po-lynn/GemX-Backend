import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/features/points/db/surprise-bonus", () => ({
  countActiveUsers: vi.fn(),
  createSurpriseBonusCampaign: vi.fn(),
  markSurpriseBonusCampaignProcessing: vi.fn(),
}))

vi.mock("@/lib/queue/queue", () => ({
  enqueueJob: vi.fn(),
}))

vi.mock("@/lib/queue/drain", () => ({
  drainJobs: vi.fn(),
}))

vi.mock("@/features/points/services/process-surprise-bonus-jobs", () => ({
  processSurpriseBonusJob: vi.fn(),
}))

vi.mock("@/features/points/services/process-surprise-bonus-push-jobs", () => ({
  processSurpriseBonusPushJob: vi.fn(),
}))

import {
  countActiveUsers,
  createSurpriseBonusCampaign,
  markSurpriseBonusCampaignProcessing,
} from "@/features/points/db/surprise-bonus"
import { enqueueJob } from "@/lib/queue/queue"
import { drainJobs } from "@/lib/queue/drain"
import { processSurpriseBonusJob } from "@/features/points/services/process-surprise-bonus-jobs"
import { processSurpriseBonusPushJob } from "@/features/points/services/process-surprise-bonus-push-jobs"
import { SURPRISE_BONUS_JOB_TYPE, SURPRISE_BONUS_PUSH_JOB_TYPE } from "@/drizzle/schema/surprise-bonus-schema"
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
    vi.mocked(enqueueJob).mockResolvedValue({ id: "job-1" })
    vi.mocked(drainJobs).mockResolvedValue({ batches: 0 })
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

  it("creates campaign, enqueues the first job, and drains it inline before responding", async () => {
    vi.mocked(countActiveUsers).mockResolvedValue(250)
    vi.mocked(drainJobs).mockResolvedValue({ batches: 3 })

    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "Sweet December",
      pointsPerUser: 500,
      note: "Holiday",
      createdBy: "admin-1",
    })

    expect(result).toEqual({
      success: true,
      campaignId: "camp-1",
      totalUsers: 250,
      pointsPerUser: 500,
      campaignName: "Sweet December",
      processedInline: true,
    })
    expect(createSurpriseBonusCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Sweet December", pointsPerUser: 500, totalUsers: 250, createdBy: "admin-1" }),
    )
    expect(enqueueJob).toHaveBeenCalledWith(SURPRISE_BONUS_JOB_TYPE, { campaignId: "camp-1", lastUserId: null })
    expect(markSurpriseBonusCampaignProcessing).toHaveBeenCalledWith("camp-1")
    expect(drainJobs).toHaveBeenNthCalledWith(1, SURPRISE_BONUS_JOB_TYPE, processSurpriseBonusJob, {
      maxBatches: 5,
    })
    expect(drainJobs).toHaveBeenNthCalledWith(2, SURPRISE_BONUS_PUSH_JOB_TYPE, processSurpriseBonusPushJob, {
      maxBatches: 5,
    })
  })

  it("returns an error and leaves the campaign row in place when the credit drain throws", async () => {
    vi.mocked(countActiveUsers).mockResolvedValue(250)
    vi.mocked(drainJobs).mockRejectedValue(new Error("relation missing"))

    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "Sweet December",
      pointsPerUser: 500,
      createdBy: "admin-1",
    })

    expect(result).toEqual({
      error:
        "Campaign created but crediting failed: relation missing. Check RPCs (claim_background_job / grant_surprise_bonus_user) and retry the Top-up.",
    })
    expect(drainJobs).toHaveBeenCalledTimes(1)
  })

  it("still returns success when only the push drain fails — credits already committed", async () => {
    vi.mocked(countActiveUsers).mockResolvedValue(250)
    vi.mocked(drainJobs)
      .mockResolvedValueOnce({ batches: 3 })
      .mockRejectedValueOnce(new Error("FCM not configured"))

    const result = await enqueueSurpriseBonusForAllUsers({
      campaignName: "Sweet December",
      pointsPerUser: 500,
      createdBy: "admin-1",
    })

    expect(result).toEqual({
      success: true,
      campaignId: "camp-1",
      totalUsers: 250,
      pointsPerUser: 500,
      campaignName: "Sweet December",
      processedInline: true,
    })
    expect(drainJobs).toHaveBeenCalledTimes(2)
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

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/features/points/services/surprise-bonus-push", () => ({
  sendSurpriseBonusPushToUsers: vi.fn(),
}))

vi.mock("@/lib/queue/registry", () => ({
  registerQueueJob: vi.fn(),
}))

import { sendSurpriseBonusPushToUsers } from "@/features/points/services/surprise-bonus-push"
import { registerQueueJob } from "@/lib/queue/registry"
import { SURPRISE_BONUS_PUSH_JOB_TYPE } from "@/drizzle/schema/surprise-bonus-schema"
import {
  describeSurpriseBonusPushJobs,
  processSurpriseBonusPushJob,
} from "@/features/points/services/process-surprise-bonus-push-jobs"

function claimedJob(payload: Record<string, unknown>) {
  return { id: "job-1", type: SURPRISE_BONUS_PUSH_JOB_TYPE, payload, attempts: 1, maxAttempts: 5 }
}

it("registers itself as the surprise_bonus_push_batch queue job handler on import", () => {
  expect(registerQueueJob).toHaveBeenCalledWith(
    expect.objectContaining({
      type: SURPRISE_BONUS_PUSH_JOB_TYPE,
      label: "Surprise Bonus Push",
      handler: processSurpriseBonusPushJob,
    }),
  )
})

describe("processSurpriseBonusPushJob", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("throws on a payload missing required fields", async () => {
    await expect(processSurpriseBonusPushJob(claimedJob({ campaignId: "camp-1" }))).rejects.toThrow(
      "Invalid surprise bonus push payload",
    )
    expect(sendSurpriseBonusPushToUsers).not.toHaveBeenCalled()
  })

  it("throws on an empty userIds array", async () => {
    await expect(
      processSurpriseBonusPushJob(
        claimedJob({ campaignId: "camp-1", campaignName: "Sweet December", pointsPerUser: 500, userIds: [] }),
      ),
    ).rejects.toThrow("Invalid surprise bonus push payload")
  })

  it("sends push to the payload's user ids and completes normally on success", async () => {
    vi.mocked(sendSurpriseBonusPushToUsers).mockResolvedValue({ sent: 2, failed: 0, invalidTokensRemoved: 0 })

    const result = await processSurpriseBonusPushJob(
      claimedJob({ campaignId: "camp-1", campaignName: "Sweet December", pointsPerUser: 500, userIds: ["u1", "u2"] }),
    )

    expect(sendSurpriseBonusPushToUsers).toHaveBeenCalledWith({
      userIds: ["u1", "u2"],
      campaignId: "camp-1",
      campaignName: "Sweet December",
      pointsPerUser: 500,
    })
    expect(result).toEqual({ recipients: 2, sent: 2, failed: 0, invalidTokensRemoved: 0 })
  })

  it("does not throw when nobody has a registered device (sent: 0, failed: 0)", async () => {
    vi.mocked(sendSurpriseBonusPushToUsers).mockResolvedValue({ sent: 0, failed: 0, invalidTokensRemoved: 0 })

    await expect(
      processSurpriseBonusPushJob(
        claimedJob({ campaignId: "camp-1", campaignName: "Sweet December", pointsPerUser: 500, userIds: ["u1"] }),
      ),
    ).resolves.toEqual({ recipients: 1, sent: 0, failed: 0, invalidTokensRemoved: 0 })
  })

  it("throws when every send attempt fails, so the job surfaces as failed on /admin/queue", async () => {
    vi.mocked(sendSurpriseBonusPushToUsers).mockResolvedValue({ sent: 0, failed: 2, invalidTokensRemoved: 0 })

    await expect(
      processSurpriseBonusPushJob(
        claimedJob({
          campaignId: "camp-1",
          campaignName: "Sweet December",
          pointsPerUser: 500,
          userIds: ["u1", "u2"],
        }),
      ),
    ).rejects.toThrow("Push send failed for all 2 recipient(s)")
  })

  it("does not throw on partial success (some tokens invalid, others sent)", async () => {
    vi.mocked(sendSurpriseBonusPushToUsers).mockResolvedValue({ sent: 1, failed: 1, invalidTokensRemoved: 1 })

    await expect(
      processSurpriseBonusPushJob(
        claimedJob({
          campaignId: "camp-1",
          campaignName: "Sweet December",
          pointsPerUser: 500,
          userIds: ["u1", "u2"],
        }),
      ),
    ).resolves.toEqual({ recipients: 2, sent: 1, failed: 1, invalidTokensRemoved: 1 })
  })
})

describe("describeSurpriseBonusPushJobs", () => {
  it("maps job id to the campaignName already carried in its payload", async () => {
    const jobs = [
      { id: "job-1", payload: { campaignName: "Sweet December" } },
      { id: "job-2", payload: {} },
    ] as never

    const result = await describeSurpriseBonusPushJobs(jobs)
    expect(result.get("job-1")).toBe("Sweet December")
    expect(result.has("job-2")).toBe(false)
  })
})

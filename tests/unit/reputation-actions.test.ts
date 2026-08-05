// tests/unit/reputation-actions.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/drizzle/schema/reputation-schema", () => ({
  sellerReputationAction: {
    id: "id", sellerUserId: "seller_user_id", actionType: "action_type",
    triggerKey: "trigger_key", reason: "reason", adminUserId: "admin_user_id", createdAt: "created_at",
  },
  sellerArchive: {
    id: "id", sellerUserId: "seller_user_id", reason: "reason",
    archivedByAdminId: "archived_by_admin_id", archivedAt: "archived_at",
  },
}))
vi.mock("@/drizzle/db", () => ({
  db: { insert: vi.fn() },
}))

import { db } from "@/drizzle/db"
import { archiveSeller, dismissCase, recordSecondaryAction } from "@/features/reviews/db/reputation-actions"

describe("archiveSeller", () => {
  beforeEach(() => vi.clearAllMocks())

  it("writes a seller_archive row and an 'archived' action row", async () => {
    const archiveValuesMock = vi.fn().mockResolvedValue(undefined)
    const actionValuesMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(db.insert)
      .mockReturnValueOnce({ values: archiveValuesMock } as never)
      .mockReturnValueOnce({ values: actionValuesMock } as never)

    await archiveSeller({ sellerUserId: "seller-1", reason: "Below 3.8 for 6 days", adminUserId: "admin-1" })

    expect(archiveValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ sellerUserId: "seller-1", reason: "Below 3.8 for 6 days", archivedByAdminId: "admin-1" })
    )
    expect(actionValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ sellerUserId: "seller-1", actionType: "archived", adminUserId: "admin-1" })
    )
  })
})

describe("dismissCase", () => {
  beforeEach(() => vi.clearAllMocks())

  it("writes only a 'dismissed' action row with the trigger key", async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as never)

    await dismissCase({
      sellerUserId: "seller-1",
      triggerKey: "rating_below_archive",
      reason: "Reviewed manually, rating recovering",
      adminUserId: "admin-1",
    })

    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerUserId: "seller-1",
        actionType: "dismissed",
        triggerKey: "rating_below_archive",
        adminUserId: "admin-1",
      })
    )
  })
})

describe("recordSecondaryAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("writes an action row with no reason required", async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as never)

    await recordSecondaryAction({ sellerUserId: "seller-1", actionType: "warned", adminUserId: "admin-1" })

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ sellerUserId: "seller-1", actionType: "warned", adminUserId: "admin-1" })
    )
  })
})

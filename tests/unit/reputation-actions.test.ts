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
    const onConflictDoUpdateMock = vi.fn().mockResolvedValue(undefined)
    const archiveValuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock })
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

  // seller_archive has a unique index on seller_user_id, so archiving an
  // already-archived seller (double-click / double-submit / future
  // restore-then-rearchive) must upsert instead of throwing an uncaught
  // unique-constraint violation.
  it("upserts on conflict, refreshing the reason/admin/time and clearing restoredAt", async () => {
    const onConflictDoUpdateMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(db.insert)
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock }),
      } as never)
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never)

    await archiveSeller({ sellerUserId: "seller-1", reason: "Re-archived", adminUserId: "admin-2" })

    expect(onConflictDoUpdateMock).toHaveBeenCalledTimes(1)
    const arg = onConflictDoUpdateMock.mock.calls[0][0] as {
      target: string
      set: { reason: string; archivedByAdminId: string; archivedAt: Date; restoredAt: null }
    }
    expect(arg.target).toBe("seller_user_id")
    expect(arg.set.reason).toBe("Re-archived")
    expect(arg.set.archivedByAdminId).toBe("admin-2")
    expect(arg.set.archivedAt).toBeInstanceOf(Date)
    // Clearing restoredAt is what makes the row count as currently-archived
    // again for computeCaseSummaries' `restoredAt IS NULL` exclusion.
    expect(arg.set.restoredAt).toBeNull()
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

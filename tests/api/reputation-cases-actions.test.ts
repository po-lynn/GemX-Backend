import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/features/rbac/db/permissions", () => ({ checkInternalAccess: vi.fn() }))
vi.mock("@/features/reviews/db/reputation-actions", () => ({
  archiveSeller: vi.fn().mockResolvedValue(undefined),
  dismissCase: vi.fn().mockResolvedValue(undefined),
  recordSecondaryAction: vi.fn().mockResolvedValue(undefined),
}))

const { auth } = await import("@/lib/auth")
const { checkInternalAccess } = await import("@/features/rbac/db/permissions")
const { archiveSeller, dismissCase } = await import("@/features/reviews/db/reputation-actions")
const { archiveSellerAction, dismissCaseAction } = await import("@/features/reviews/actions/reputation-cases")

function form(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

describe("archiveSellerAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects with no session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never)
    const result = await archiveSellerAction(form({ sellerUserId: "s1", reason: "test" }))
    expect(result).toEqual({ error: "Unauthorized" })
    expect(archiveSeller).not.toHaveBeenCalled()
  })

  it("rejects internal staff without the reviews permission", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "staff-1", role: "internal" } } as never)
    vi.mocked(checkInternalAccess).mockResolvedValue(false)
    const result = await archiveSellerAction(form({ sellerUserId: "s1", reason: "test" }))
    expect(result).toEqual({ error: "Unauthorized" })
    expect(archiveSeller).not.toHaveBeenCalled()
  })

  it("rejects a missing reason", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    const result = await archiveSellerAction(form({ sellerUserId: "s1", reason: "" }))
    expect("error" in result).toBe(true)
    expect(archiveSeller).not.toHaveBeenCalled()
  })

  it("archives for an admin with a valid reason", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    const result = await archiveSellerAction(form({ sellerUserId: "s1", reason: "Below 3.8 for 6 days" }))
    expect(result).toEqual({ success: true })
    expect(archiveSeller).toHaveBeenCalledWith({
      sellerUserId: "s1",
      reason: "Below 3.8 for 6 days",
      adminUserId: "admin-1",
    })
  })

  it("allows internal staff who hold the reviews permission", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "staff-1", role: "internal" } } as never)
    vi.mocked(checkInternalAccess).mockResolvedValue(true)
    const result = await archiveSellerAction(form({ sellerUserId: "s1", reason: "test" }))
    expect(result).toEqual({ success: true })
  })
})

describe("dismissCaseAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("dismisses with a valid trigger key and reason", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    const result = await dismissCaseAction(
      form({ sellerUserId: "s1", triggerKey: "rating_below_archive", reason: "Recovering" })
    )
    expect(result).toEqual({ success: true })
    expect(dismissCase).toHaveBeenCalledWith({
      sellerUserId: "s1",
      triggerKey: "rating_below_archive",
      reason: "Recovering",
      adminUserId: "admin-1",
    })
  })

  it("rejects an invalid trigger key", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    const result = await dismissCaseAction(
      form({ sellerUserId: "s1", triggerKey: "not_a_real_rule", reason: "x" })
    )
    expect("error" in result).toBe(true)
    expect(dismissCase).not.toHaveBeenCalled()
  })
})

// Finding #6: before this, a DB-level throw (e.g. seller_archive's unique
// constraint on a double-submit) escaped every layer as an unhandled promise
// rejection — the client's toast.error path never fired because the action
// never returned. Each action now converts a throw into { error }.
describe("DB failures surface as { error } instead of unhandled rejections", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns the DB error message when archiveSeller throws", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    vi.mocked(archiveSeller).mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "seller_archive_seller_user_id_unique"')
    )
    const result = await archiveSellerAction(form({ sellerUserId: "s1", reason: "Below 3.8" }))
    expect(result).toEqual({
      error: 'duplicate key value violates unique constraint "seller_archive_seller_user_id_unique"',
    })
  })

  it("falls back to a generic message when the thrown value is not an Error", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    vi.mocked(archiveSeller).mockRejectedValueOnce("socket hang up")
    const result = await archiveSellerAction(form({ sellerUserId: "s1", reason: "Below 3.8" }))
    expect(result).toEqual({ error: "Failed to archive seller" })
  })

  it("returns the DB error message when dismissCase throws", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    vi.mocked(dismissCase).mockRejectedValueOnce(new Error("connection terminated"))
    const result = await dismissCaseAction(
      form({ sellerUserId: "s1", triggerKey: "rating_below_archive", reason: "x" })
    )
    expect(result).toEqual({ error: "connection terminated" })
  })

  // A bulk loop aborts on the first failure and names where it stopped, rather
  // than continuing past a DB error and reporting overall success.
  it("aborts a bulk archive on the first failure and reports the item", async () => {
    const { bulkArchiveSellersAction } = await import("@/features/reviews/actions/reputation-cases")
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "admin-1", role: "admin" } } as never)
    vi.mocked(archiveSeller)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("deadlock detected"))

    const result = await bulkArchiveSellersAction(["s1", "s2", "s3"], "Bulk reason")

    expect("error" in result).toBe(true)
    expect((result as { error: string }).error).toContain("s2")
    expect((result as { error: string }).error).toContain("deadlock detected")
    // s3 is never attempted — the loop stops at the failure.
    expect(archiveSeller).toHaveBeenCalledTimes(2)
  })
})

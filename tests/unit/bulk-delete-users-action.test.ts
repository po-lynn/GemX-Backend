import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: { api: { signUpEmail: vi.fn(), setUserPassword: vi.fn() } },
}))

const requireActionRole = vi.fn()
vi.mock("@/lib/action-guard", () => ({
  requireActionRole: (...args: unknown[]) => requireActionRole(...args),
}))

const deleteUsersInDb = vi.fn()
vi.mock("@/features/users/db/users", () => ({
  updateUserInDb: vi.fn(),
  deleteUserInDb: vi.fn(),
  deleteUsersInDb: (...args: unknown[]) => deleteUsersInDb(...args),
  getUserByEmail: vi.fn(),
  searchUsersForPicker: vi.fn(),
}))

vi.mock("@/features/points/db/points", () => ({
  applyDefaultPointsToNewUser: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))

beforeEach(() => {
  vi.clearAllMocks()
  requireActionRole.mockResolvedValue({ user: { id: "admin-1", role: "admin" } })
})

describe("bulkDeleteUsersAction", () => {
  // Rejects an empty selection before touching auth or the database.
  it("returns a validation error for an empty id list", async () => {
    const { bulkDeleteUsersAction } = await import("@/features/users/actions/users")

    const result = await bulkDeleteUsersAction([])

    expect(result.error).toBeTruthy()
    expect(requireActionRole).not.toHaveBeenCalled()
    expect(deleteUsersInDb).not.toHaveBeenCalled()
  })

  // Only admins/internal staff (per canAdminManageUsers) may bulk-delete users.
  it("returns Unauthorized when the caller lacks permission", async () => {
    requireActionRole.mockResolvedValue(null)
    const { bulkDeleteUsersAction } = await import("@/features/users/actions/users")

    const result = await bulkDeleteUsersAction(["u1", "u2"])

    expect(result).toEqual({ error: "Unauthorized" })
    expect(deleteUsersInDb).not.toHaveBeenCalled()
  })

  // An admin must never be able to delete their own account via the bulk action.
  it("refuses to delete the caller's own account, even mixed in with others", async () => {
    const { bulkDeleteUsersAction } = await import("@/features/users/actions/users")

    const result = await bulkDeleteUsersAction(["u1", "admin-1"])

    expect(result).toEqual({ error: "You cannot delete your own account." })
    expect(deleteUsersInDb).not.toHaveBeenCalled()
  })

  // Happy path: deletes the selected users and reports how many were removed.
  it("deletes the selected users and returns the count", async () => {
    deleteUsersInDb.mockResolvedValue(2)
    const { bulkDeleteUsersAction } = await import("@/features/users/actions/users")

    const result = await bulkDeleteUsersAction(["u1", "u2"])

    expect(deleteUsersInDb).toHaveBeenCalledWith(["u1", "u2"])
    expect(result).toEqual({ success: true, count: 2 })
  })
})

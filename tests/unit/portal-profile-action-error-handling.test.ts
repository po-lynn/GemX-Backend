import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/action-guard", () => ({
  requireActionRole: vi.fn().mockResolvedValue({ user: { id: "portal-user-1", role: "portal" } }),
}))

vi.mock("@/features/users/db/users", () => ({
  updateUserInDb: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

function buildInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Phyu Phyu Aung",
    phone: "+959741 28830",
    gender: "female",
    dateOfBirth: "1994-03-14",
    nrc: "12/MAN(N)123456",
    address: "No. 42, Pyay Road",
    city: "Kamayut",
    state: "Yangon",
    country: "Myanmar",
    image: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("updatePortalProfileAction — updateUserInDb failure handling", () => {
  // The unique index on user.nrc rejects at the DB layer; the action must translate
  // the raw Postgres constraint error into the same friendly message used by the
  // mobile registration/profile routes and the admin user actions, not let it surface raw.
  it("maps a duplicate NRC constraint error to a friendly message", async () => {
    const { updateUserInDb } = await import("@/features/users/db/users")
    vi.mocked(updateUserInDb).mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "user_nrc_unique"')
    )
    const { updatePortalProfileAction } = await import("@/features/users/actions/portal-profile")

    await expect(updatePortalProfileAction(buildInput())).resolves.toEqual({
      ok: false,
      error: "This NRC number is already registered to another account.",
    })
  })

  it("maps a duplicate phone constraint error to a friendly message", async () => {
    const { updateUserInDb } = await import("@/features/users/db/users")
    vi.mocked(updateUserInDb).mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "user_phone_unique"')
    )
    const { updatePortalProfileAction } = await import("@/features/users/actions/portal-profile")

    await expect(updatePortalProfileAction(buildInput())).resolves.toEqual({
      ok: false,
      error: "This phone number is already associated with another account.",
    })
  })

  it("rethrows unrecognized DB errors instead of swallowing them", async () => {
    const { updateUserInDb } = await import("@/features/users/db/users")
    vi.mocked(updateUserInDb).mockRejectedValueOnce(new Error("connection terminated"))
    const { updatePortalProfileAction } = await import("@/features/users/actions/portal-profile")

    await expect(updatePortalProfileAction(buildInput())).rejects.toThrow("connection terminated")
  })

  it("rejects an invalid NRC format before reaching the database", async () => {
    const { updateUserInDb } = await import("@/features/users/db/users")
    const { updatePortalProfileAction } = await import("@/features/users/actions/portal-profile")

    const result = await updatePortalProfileAction(buildInput({ nrc: "not-an-nrc" }))

    expect(result.ok).toBe(false)
    expect(updateUserInDb).not.toHaveBeenCalled()
  })

  it("returns success and does not throw when the update succeeds", async () => {
    const { updatePortalProfileAction } = await import("@/features/users/actions/portal-profile")

    await expect(updatePortalProfileAction(buildInput())).resolves.toEqual({ ok: true })
  })
})

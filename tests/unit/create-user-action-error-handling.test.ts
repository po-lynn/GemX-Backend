import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: { api: { signUpEmail: vi.fn() } },
}))

vi.mock("@/lib/action-guard", () => ({
  requireActionRole: vi.fn().mockResolvedValue({ user: { id: "admin-1", role: "admin" } }),
}))

vi.mock("@/features/users/db/users", () => ({
  updateUserInDb: vi.fn().mockResolvedValue(undefined),
  deleteUserInDb: vi.fn(),
  getUserByEmail: vi.fn().mockResolvedValue({ id: "new-user-1" }),
  searchUsersForPicker: vi.fn(),
}))

vi.mock("@/features/points/db/points", () => ({
  applyDefaultPointsToNewUser: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))

function buildFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData()
  fd.set("name", "Test User")
  fd.set("email", "user@example.com")
  fd.set("password", "password123")
  fd.set("role", "user")
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createUserAction — signUpEmail failure handling", () => {
  // better-auth's signUpEmail throws an APIError on failure instead of returning { error };
  // the action must catch it and return a structured error, not let it become an unhandled rejection.
  it("returns a structured duplicate-email error instead of throwing when signUpEmail throws", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth.api.signUpEmail).mockRejectedValueOnce(
      new Error("User already exists. Use another email.")
    )
    const { createUserAction } = await import("@/features/users/actions/users")

    await expect(createUserAction(buildFormData())).resolves.toEqual({
      error: "A user with this email already exists.",
    })
  })

  it("maps a duplicate NRC constraint error to a friendly message", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth.api.signUpEmail).mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "user_nrc_unique"')
    )
    const { createUserAction } = await import("@/features/users/actions/users")

    await expect(createUserAction(buildFormData())).resolves.toEqual({
      error: "This NRC number is already registered to another account.",
    })
  })

  it("falls back to the thrown error's message for unrecognized failures", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth.api.signUpEmail).mockRejectedValueOnce(new Error("Password too short"))
    const { createUserAction } = await import("@/features/users/actions/users")

    await expect(createUserAction(buildFormData())).resolves.toEqual({
      error: "Password too short",
    })
  })

  it("returns success and does not throw when signUpEmail succeeds", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth.api.signUpEmail).mockResolvedValueOnce({} as never)
    const { createUserAction } = await import("@/features/users/actions/users")

    await expect(createUserAction(buildFormData())).resolves.toEqual({ success: true })
  })
})

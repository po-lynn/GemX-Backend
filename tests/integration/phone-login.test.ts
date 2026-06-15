import { describe, it, expect, vi } from "vitest"

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "1.2.3.4" })),
}))

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}))

describe("getEmailForPhoneLoginAction", () => {
  it("resolves valid 09... phone to email", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.limit).mockResolvedValueOnce([{ email: "dealer@example.com" }])
    const { getEmailForPhoneLoginAction } = await import("@/features/users/actions/phone-login")
    const result = await getEmailForPhoneLoginAction("09123456789")
    expect(result).toBe("dealer@example.com")
  })

  it("resolves valid +959... phone to email", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.limit).mockResolvedValueOnce([{ email: "dealer@example.com" }])
    const { getEmailForPhoneLoginAction } = await import("@/features/users/actions/phone-login")
    const result = await getEmailForPhoneLoginAction("+959123456789")
    expect(result).toBe("dealer@example.com")
  })

  it("returns null for non-Myanmar phone format", async () => {
    const { getEmailForPhoneLoginAction } = await import("@/features/users/actions/phone-login")
    // Normalization returns null → action returns null without querying
    const result = await getEmailForPhoneLoginAction("+1234567890")
    expect(result).toBeNull()
  })

  it("returns null when phone not found in DB", async () => {
    const { getEmailForPhoneLoginAction } = await import("@/features/users/actions/phone-login")
    const result = await getEmailForPhoneLoginAction("09999999999")
    expect(result).toBeNull()
  })
})

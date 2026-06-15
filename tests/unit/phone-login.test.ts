import { describe, it, expect, vi } from "vitest"
import { normalizeMyanmarPhone } from "@/lib/phone"

// Mock Drizzle db to test getUserEmailByPhone
vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}))

describe("normalizeMyanmarPhone — extended for E.164 input", () => {
  // Domestic format → E.164
  it("normalizes 09... to +959...", () => {
    expect(normalizeMyanmarPhone("09123456789")).toBe("+959123456789")
  })
  // E.164 input passes through unchanged
  it("accepts +959... input unchanged", () => {
    expect(normalizeMyanmarPhone("+959123456789")).toBe("+959123456789")
  })
  // Strips spaces and dashes before normalizing
  it("normalizes 09-123 456 789 to +959123456789", () => {
    expect(normalizeMyanmarPhone("09-123 456 789")).toBe("+959123456789")
  })
  // Invalid +959 format returns null
  it("returns null for invalid +959 format", () => {
    expect(normalizeMyanmarPhone("+9591234")).toBe(null)
  })
  // Non-Myanmar number returns null
  it("returns null for non-Myanmar number", () => {
    expect(normalizeMyanmarPhone("+1234567890")).toBe(null)
  })
  // Invalid 09 format returns null
  it("returns null for 09 with too few digits", () => {
    expect(normalizeMyanmarPhone("091234")).toBe(null)
  })
  // Empty input returns null
  it("returns null for empty input", () => {
    expect(normalizeMyanmarPhone("")).toBe(null)
  })
})

describe("getUserEmailByPhone", () => {
  it("returns email when phone matches a user", async () => {
    const { db } = await import("@/drizzle/db")
    vi.mocked(db.limit).mockResolvedValueOnce([{ email: "portal@example.com" }])
    const { getUserEmailByPhone } = await import("@/features/users/db/users")
    const result = await getUserEmailByPhone("+959123456789")
    expect(result).toBe("portal@example.com")
  })

  it("returns null when phone has no matching user", async () => {
    const { getUserEmailByPhone } = await import("@/features/users/db/users")
    const result = await getUserEmailByPhone("+959000000000")
    expect(result).toBeNull()
  })
})

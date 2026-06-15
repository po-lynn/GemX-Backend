import { describe, it, expect } from "vitest"
import { looksLikePhone } from "@/lib/login-detect"

describe("looksLikePhone", () => {
  // Myanmar domestic format
  it("detects 09... as phone", () => expect(looksLikePhone("09123456789")).toBe(true))
  // E.164 format
  it("detects +959... as phone", () => expect(looksLikePhone("+959123456789")).toBe(true))
  // Phone with spaces and dashes
  it("detects 09-123 456 789 as phone", () => expect(looksLikePhone("09-123 456 789")).toBe(true))
  // Phone with parentheses
  it("detects (09)123456789 as phone", () => expect(looksLikePhone("(09)123456789")).toBe(true))

  // Email addresses must not match
  it("rejects standard email", () => expect(looksLikePhone("admin@example.com")).toBe(false))
  it("rejects email with subdomain", () => expect(looksLikePhone("user@portal.co")).toBe(false))
  it("rejects number-like email (1234567@gmail.com)", () => expect(looksLikePhone("1234567@gmail.com")).toBe(false))

  // Too short
  it("rejects short string", () => expect(looksLikePhone("12345")).toBe(false))
  // Contains letters
  it("rejects alphanumeric input", () => expect(looksLikePhone("09abc123")).toBe(false))
  // Plain text
  it("rejects plain text", () => expect(looksLikePhone("hello world")).toBe(false))
  // Empty string
  it("rejects empty string", () => expect(looksLikePhone("")).toBe(false))
})

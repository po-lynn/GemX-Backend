import { describe, it, expect } from "vitest"
import { z } from "zod"
import { emptyToNull, emptyToUndefined, zodErrorMessage } from "@/lib/form-data"

describe("emptyToNull", () => {
  // Empty string means "clear the column" in update actions
  it("maps empty string to null", () => {
    expect(emptyToNull("")).toBeNull()
  })

  // Missing FormData entries (null) mean "leave the field unchanged"
  it("maps null and undefined to undefined", () => {
    expect(emptyToNull(null)).toBeUndefined()
    expect(emptyToNull(undefined)).toBeUndefined()
  })

  // Real values pass through untouched
  it("passes non-empty values through", () => {
    expect(emptyToNull("abc")).toBe("abc")
    expect(emptyToNull("0")).toBe("0")
  })
})

describe("emptyToUndefined", () => {
  // Empty string means "skip" (no null/clear semantics)
  it("maps empty string to undefined", () => {
    expect(emptyToUndefined("")).toBeUndefined()
  })

  // Real values pass through untouched
  it("passes non-empty values through", () => {
    expect(emptyToUndefined("x")).toBe("x")
  })
})

describe("zodErrorMessage", () => {
  // Top-level (form) errors win over field errors
  it("returns joined form errors when present", () => {
    const schema = z
      .object({ a: z.string() })
      .refine(() => false, { message: "form broken" })
    const parsed = schema.safeParse({ a: "x" })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(zodErrorMessage(parsed.error)).toBe("form broken")
    }
  })

  // Field errors are rendered as "field: message" when no form errors exist
  it("falls back to field errors with field names", () => {
    const schema = z.object({ title: z.string().min(1, "required") })
    const parsed = schema.safeParse({ title: "" })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(zodErrorMessage(parsed.error)).toBe("title: required")
    }
  })

  // Defensive default when the error carries no messages at all
  it('returns "Invalid input" when there are no messages', () => {
    const error = new z.ZodError([])
    expect(zodErrorMessage(error)).toBe("Invalid input")
  })
})

import { describe, it, expect } from "vitest"
import {
  precautionTagCreateSchema,
  precautionTagUpdateSchema,
  precautionTagDeleteSchema,
} from "@/features/precaution-tags/schemas/precaution-tags"

describe("precautionTagCreateSchema", () => {
  it("accepts valid input with all fields", () => {
    const result = precautionTagCreateSchema.safeParse({
      name: "No lab certificate",
      severity: "critical",
      appliesTo: "non_certified",
      isActive: true,
    })
    expect(result.success).toBe(true)
  })

  it("accepts all severity variants", () => {
    for (const severity of ["critical", "warning", "info"] as const) {
      const result = precautionTagCreateSchema.safeParse({
        name: "Test",
        severity,
        appliesTo: "both",
        isActive: true,
      })
      expect(result.success).toBe(true)
    }
  })

  it("accepts all appliesTo variants", () => {
    for (const appliesTo of ["certified", "non_certified", "both"] as const) {
      const result = precautionTagCreateSchema.safeParse({
        name: "Test",
        severity: "warning",
        appliesTo,
        isActive: false,
      })
      expect(result.success).toBe(true)
    }
  })

  it("rejects empty name", () => {
    const result = precautionTagCreateSchema.safeParse({
      name: "",
      severity: "warning",
      appliesTo: "both",
      isActive: true,
    })
    expect(result.success).toBe(false)
  })

  it("rejects name over 200 chars", () => {
    const result = precautionTagCreateSchema.safeParse({
      name: "a".repeat(201),
      severity: "info",
      appliesTo: "certified",
      isActive: true,
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid severity value", () => {
    const result = precautionTagCreateSchema.safeParse({
      name: "Test",
      severity: "extreme",
      appliesTo: "both",
      isActive: true,
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid appliesTo value", () => {
    const result = precautionTagCreateSchema.safeParse({
      name: "Test",
      severity: "warning",
      appliesTo: "noncert",
      isActive: true,
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing isActive", () => {
    const result = precautionTagCreateSchema.safeParse({
      name: "Test",
      severity: "info",
      appliesTo: "both",
    })
    expect(result.success).toBe(false)
  })
})

describe("precautionTagUpdateSchema", () => {
  it("accepts valid update with uuid", () => {
    const result = precautionTagUpdateSchema.safeParse({
      precautionTagId: "123e4567-e89b-12d3-a456-426614174000",
      name: "Updated name",
      severity: "critical",
      appliesTo: "certified",
      isActive: false,
    })
    expect(result.success).toBe(true)
  })

  it("rejects non-uuid precautionTagId", () => {
    const result = precautionTagUpdateSchema.safeParse({
      precautionTagId: "not-a-uuid",
      name: "Test",
      severity: "info",
      appliesTo: "both",
      isActive: true,
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty name", () => {
    const result = precautionTagUpdateSchema.safeParse({
      precautionTagId: "123e4567-e89b-12d3-a456-426614174000",
      name: "",
      severity: "warning",
      appliesTo: "non_certified",
      isActive: true,
    })
    expect(result.success).toBe(false)
  })
})

describe("precautionTagDeleteSchema", () => {
  it("accepts valid uuid", () => {
    const result = precautionTagDeleteSchema.safeParse({
      precautionTagId: "123e4567-e89b-12d3-a456-426614174000",
    })
    expect(result.success).toBe(true)
  })

  it("rejects non-uuid", () => {
    const result = precautionTagDeleteSchema.safeParse({
      precautionTagId: "not-a-uuid",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing id", () => {
    const result = precautionTagDeleteSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

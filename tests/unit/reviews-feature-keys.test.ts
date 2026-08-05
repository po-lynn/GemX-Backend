import { describe, expect, it } from "vitest"
import { FEATURE_KEYS, FEATURE_GROUPS } from "@/features/rbac/feature-keys"

describe("FEATURE_KEYS.REVIEWS", () => {
  it("is defined as 'reviews'", () => {
    expect(FEATURE_KEYS.REVIEWS).toBe("reviews")
  })

  it("appears exactly once across all FEATURE_GROUPS", () => {
    const allKeys = FEATURE_GROUPS.flatMap((g) => g.features.map((f) => f.key))
    const matches = allKeys.filter((k) => k === FEATURE_KEYS.REVIEWS)
    expect(matches).toHaveLength(1)
  })

  it("is placed under the Trust & Reputation group", () => {
    const group = FEATURE_GROUPS.find((g) =>
      g.features.some((f) => f.key === FEATURE_KEYS.REVIEWS)
    )
    expect(group?.label).toBe("Trust & Reputation")
  })
})

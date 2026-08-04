import { describe, it, expect } from "vitest"
import { FEATURE_GROUPS, FEATURE_KEYS, featureSaveKeys } from "@/features/rbac/feature-keys"

describe("Communication feature group", () => {
  // Messages and Chat Dashboard were merged into one triage inbox page —
  // the admin permission UI must expose exactly one toggle for it.
  it("exposes a single Messages toggle, not a separate Chat Dashboard entry", () => {
    const communication = FEATURE_GROUPS.find((g) => g.label === "Communication")
    expect(communication?.features).toHaveLength(1)
    expect(communication?.features[0].key).toBe(FEATURE_KEYS.MESSAGES)
  })

  it("carries chat_dashboard as an alias key so both stay in sync when saved", () => {
    const communication = FEATURE_GROUPS.find((g) => g.label === "Communication")
    const messages = communication!.features[0]
    expect(featureSaveKeys(messages)).toEqual([FEATURE_KEYS.MESSAGES, FEATURE_KEYS.CHAT_DASHBOARD])
  })
})

describe("featureSaveKeys", () => {
  it("returns just the primary key when a feature has no aliases", () => {
    expect(featureSaveKeys({ key: FEATURE_KEYS.PRODUCTS, label: "Products" })).toEqual([FEATURE_KEYS.PRODUCTS])
  })

  it("returns the primary key plus all alias keys when present", () => {
    expect(
      featureSaveKeys({ key: FEATURE_KEYS.MESSAGES, label: "Messages", aliasKeys: [FEATURE_KEYS.CHAT_DASHBOARD] })
    ).toEqual([FEATURE_KEYS.MESSAGES, FEATURE_KEYS.CHAT_DASHBOARD])
  })
})

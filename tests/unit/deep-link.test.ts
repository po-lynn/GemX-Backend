import { describe, it, expect, beforeEach, afterEach } from "vitest"

const ENV_KEYS = ["APPLE_TEAM_ID", "ANDROID_SHA256_CERT_FINGERPRINTS", "IOS_APP_STORE_URL"] as const

async function loadDeepLinkModule() {
  const { vi } = await import("vitest")
  vi.resetModules()
  return import("@/lib/deep-link")
}

describe("lib/deep-link", () => {
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key]
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnv[key]
    }
  })

  // appID must be "TEAMID.bundleId" per Apple's AASA spec
  it("builds APPLE_APP_ID from APPLE_TEAM_ID and the fixed bundle id", async () => {
    process.env.APPLE_TEAM_ID = "ABCDE12345"
    const { APPLE_APP_ID } = await loadDeepLinkModule()
    expect(APPLE_APP_ID).toBe("ABCDE12345.com.kyawminkhant.GemX")
  })

  // Splits, trims, and drops empties so a trailing comma or stray space doesn't produce a bad fingerprint entry
  it("parses ANDROID_SHA256_CERT_FINGERPRINTS as a trimmed, comma-separated list", async () => {
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS = " AA:BB , CC:DD ,,"
    const { ANDROID_SHA256_CERT_FINGERPRINTS } = await loadDeepLinkModule()
    expect(ANDROID_SHA256_CERT_FINGERPRINTS).toEqual(["AA:BB", "CC:DD"])
  })

  // Unset env must not crash the assetlinks.json route — it should just be an empty list
  it("defaults ANDROID_SHA256_CERT_FINGERPRINTS to an empty array when unset", async () => {
    delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS
    const { ANDROID_SHA256_CERT_FINGERPRINTS } = await loadDeepLinkModule()
    expect(ANDROID_SHA256_CERT_FINGERPRINTS).toEqual([])
  })

  // Falls back to a placeholder store URL so the page still renders before the app is listed
  it("falls back to a placeholder IOS_APP_STORE_URL when unset", async () => {
    delete process.env.IOS_APP_STORE_URL
    const { IOS_APP_STORE_URL } = await loadDeepLinkModule()
    expect(IOS_APP_STORE_URL).toBe("https://apps.apple.com/app/idXXXXXXXXX")
  })

  it("builds the custom-scheme deep link used for the same-page app-open attempt", async () => {
    const { productDeepLinkUrl } = await loadDeepLinkModule()
    expect(productDeepLinkUrl("abc-123")).toBe("gemx://products/abc-123")
  })
})

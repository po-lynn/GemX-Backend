import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const ENV_KEYS = ["APPLE_TEAM_ID", "ANDROID_SHA256_CERT_FINGERPRINTS"] as const

async function loadRoutes() {
  vi.resetModules()
  const aasa = await import("@/app/.well-known/apple-app-site-association/route")
  const assetlinks = await import("@/app/.well-known/assetlinks.json/route")
  return { aasa, assetlinks }
}

describe(".well-known deep-link routes", () => {
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

  // iOS requires 200 + application/json with no redirect; scoping to /products/* keeps
  // other routes (admin, api, articles) from being swept into the universal link.
  it("apple-app-site-association returns the appID scoped to /products/*", async () => {
    process.env.APPLE_TEAM_ID = "TEAMID123"
    const { aasa } = await loadRoutes()
    const response = aasa.GET()
    expect(response.headers.get("content-type")).toContain("application/json")
    const body = await response.json()
    expect(body).toEqual({
      applinks: {
        apps: [],
        details: [{ appID: "TEAMID123.com.kyawminkhant.GemX", paths: ["/products/*"] }],
      },
    })
  })

  // Android verifies package_name + fingerprint before treating the domain as app-linked
  it("assetlinks.json returns the package name and configured fingerprints", async () => {
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS = "AA:BB:CC,DD:EE:FF"
    const { assetlinks } = await loadRoutes()
    const response = assetlinks.GET()
    const body = await response.json()
    expect(body).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.kyawminkhant.GemX",
          sha256_cert_fingerprints: ["AA:BB:CC", "DD:EE:FF"],
        },
      },
    ])
  })

  // Unconfigured fingerprints must not crash the route — an empty list just fails verification, not the request
  it("assetlinks.json returns an empty fingerprint list when unconfigured", async () => {
    delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS
    const { assetlinks } = await loadRoutes()
    const response = assetlinks.GET()
    const body = await response.json()
    expect(body[0].target.sha256_cert_fingerprints).toEqual([])
  })
})

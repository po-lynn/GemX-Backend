import { describe, it, expect } from "vitest"

// ProductsListView is a "use client" module — dynamic import avoids jsdom issues
async function getBuildEditHref() {
  const mod = await import("@/features/products/components/ProductsListView")
  return mod.buildEditHref
}

describe("buildEditHref", () => {
  it("encodes view, search, page, and price params", async () => {
    const buildEditHref = await getBuildEditHref()
    const href = buildEditHref("abc123", "pending", "ruby", 3, "500", "2000", undefined, undefined)
    expect(href).toBe(
      "/admin/products/abc123/edit?view=pending&search=ruby&page=3&priceMinUSD=500&priceMaxUSD=2000"
    )
  })

  it("omits 'view' param when view is 'all'", async () => {
    const buildEditHref = await getBuildEditHref()
    const href = buildEditHref("xyz", "all", undefined, 1)
    expect(href).toBe("/admin/products/xyz/edit?page=1")
  })

  it("trims and omits blank search", async () => {
    const buildEditHref = await getBuildEditHref()
    const href = buildEditHref("xyz", "all", "  ", 1)
    expect(href).toBe("/admin/products/xyz/edit?page=1")
  })

  it("omits undefined price params", async () => {
    const buildEditHref = await getBuildEditHref()
    const href = buildEditHref("xyz", "featured", "gem", 2, undefined, "5000")
    expect(href).toBe("/admin/products/xyz/edit?view=featured&search=gem&page=2&priceMaxUSD=5000")
  })
})

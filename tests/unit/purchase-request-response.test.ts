import { describe, expect, it } from "vitest"
import {
  normalizePurchaseRequestBody,
  serializePointPurchaseRequest,
} from "@/features/points/api/purchase-request-response"

describe("serializePointPurchaseRequest", () => {
  it("maps packageName to package_name in JSON", () => {
    const created = new Date("2024-06-01T10:00:00.000Z")
    const out = serializePointPurchaseRequest({
      id: "req-1",
      packageName: "Starter Pack",
      paymentMethod: "KBZ Pay",
      points: 100,
      price: 5000,
      currency: "mmk",
      status: "approved",
      transferredAmount: 5000,
      transferredName: "Ko Aung",
      transactionReference: "TXN-1",
      transferNote: null,
      adminNote: null,
      createdAt: created,
      reviewedAt: null,
    })
    expect(out.package_name).toBe("Starter Pack")
    expect(out.payment_method).toBe("KBZ Pay")
    expect(out).not.toHaveProperty("packageName")
    expect(out).not.toHaveProperty("paymentMethod")
    expect(out.createdAt).toBe(created.toISOString())
  })
})

describe("normalizePurchaseRequestBody", () => {
  it("copies packageName to package_name when package_name is missing", () => {
    const out = normalizePurchaseRequestBody({
      packageName: "Gold Pack",
      currency: "mmk",
    }) as Record<string, unknown>
    expect(out.package_name).toBe("Gold Pack")
  })

  it("prefers package_name when both are present", () => {
    const out = normalizePurchaseRequestBody({
      package_name: "A",
      packageName: "B",
    }) as Record<string, unknown>
    expect(out.package_name).toBe("A")
  })

  it("copies paymentMethod to payment_method when payment_method is missing", () => {
    const out = normalizePurchaseRequestBody({
      paymentMethod: "KBZ Pay",
    }) as Record<string, unknown>
    expect(out.payment_method).toBe("KBZ Pay")
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { connection } from "next/server"
import { getCachedProduct } from "@/features/products/db/cache/products"
import type { ProductForEdit } from "@/features/products/db/products"
import { generateMetadata } from "@/app/products/[id]/page"

vi.mock("next/server", () => ({
  connection: vi.fn(),
}))
vi.mock("@/features/products/db/cache/products", () => ({
  getCachedProduct: vi.fn(),
}))

const params = (id: string) => Promise.resolve({ id })

const baseProduct: ProductForEdit = {
  id: "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
  sku: "SAPP-0001",
  title: "Ceylon Blue Sapphire",
  description: "A vivid, eye-clean 3.2ct Ceylon sapphire.",
  language: "English",
  descriptionEn: "A vivid, eye-clean 3.2ct Ceylon sapphire.",
  descriptionMy: null,
  descriptionTh: null,
  descriptionKo: null,
  identification: null,
  price: "4200.00",
  currency: "USD",
  isNegotiable: false,
  productType: "loose_stone",
  categoryId: null,
  stoneCut: null,
  metal: null,
  jewelleryGemstones: [],
  totalWeightGrams: null,
  pieceCount: null,
  weightCarat: null,
  dimensions: null,
  color: null,
  shape: null,
  origin: null,
  laboratoryId: null,
  certReportNumber: null,
  certReportDate: null,
  certReportUrl: null,
  additionalMemos: null,
  status: "active",
  moderationStatus: "approved",
  isFeatured: false,
  featured: 0,
  featuredDurationDays: 0,
  featuredExpiresAt: null,
  isCollectorPiece: false,
  isPrivilegeAssist: false,
  isVerified: false,
  verifiedAt: null,
  verifiedBy: null,
  sellerId: "seller-1",
  sellerName: "Aung Gems",
  imageUrls: ["https://cdn.example.com/sapphire.jpg"],
  videoUrls: [],
  changeLog: [],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

describe("generateMetadata for /products/[id]", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
  })

  // Link-preview cards (WhatsApp, iMessage, etc.) rely on these OG/Twitter fields
  it("returns title, description, and image metadata for an active product", async () => {
    vi.mocked(getCachedProduct).mockResolvedValue(baseProduct)
    const metadata = await generateMetadata({ params: params(baseProduct.id) })
    expect(metadata.title).toBe("Ceylon Blue Sapphire")
    expect(metadata.description).toBe("A vivid, eye-clean 3.2ct Ceylon sapphire.")
    expect(metadata.openGraph?.images).toEqual(["https://cdn.example.com/sapphire.jpg"])
    expect(metadata.twitter?.card).toBe("summary_large_image")
  })

  // Collector pieces are gated behind an approved show-request; an anonymous share-link
  // visitor can never hold that approval, so the description must never leak here
  it("omits the description for a collector piece", async () => {
    vi.mocked(getCachedProduct).mockResolvedValue({ ...baseProduct, isCollectorPiece: true })
    const metadata = await generateMetadata({ params: params(baseProduct.id) })
    expect(metadata.description).toBeUndefined()
    expect(metadata.title).toBe("Ceylon Blue Sapphire")
  })

  // Draft listings aren't public yet — falls back to the root layout's defaults
  it("returns empty metadata for a draft product", async () => {
    vi.mocked(getCachedProduct).mockResolvedValue({ ...baseProduct, status: "draft" })
    const metadata = await generateMetadata({ params: params(baseProduct.id) })
    expect(metadata).toEqual({})
  })

  // Non-existent id returns empty metadata rather than throwing
  it("returns empty metadata for a non-existent id", async () => {
    vi.mocked(getCachedProduct).mockResolvedValue(null)
    const metadata = await generateMetadata({ params: params("does-not-exist") })
    expect(metadata).toEqual({})
  })
})

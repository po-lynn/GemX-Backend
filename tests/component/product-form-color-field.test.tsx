import { afterEach, describe, it, expect, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { ProductForm } from "@/features/products/components/ProductForm"
import type { ProductForEdit } from "@/features/products/db/products"

afterEach(cleanup)

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/products/actions/products", () => ({
  createProductAction: vi.fn(),
  updateProductAction: vi.fn(),
}))

const looseStoneProduct = {
  id: "prod-1",
  title: "Test Gem",
  productType: "loose_stone",
  status: "active",
  moderationStatus: "approved",
  isFeatured: false,
  isCollectorPiece: false,
  isPrivilegeAssist: false,
  isNegotiable: false,
  price: "100",
  currency: "USD",
  color: "Pigeon Blood Red",
  imageUrls: [],
  videoUrls: [],
  sellerId: "seller-1",
  sellerName: "Test Seller",
  createdAt: new Date("2026-01-01"),
} as unknown as ProductForEdit

describe("ProductForm color field — plain text input (no color-table dropdown)", () => {
  // The colorId <select> populated from a colors prop has been replaced by a
  // plain required text input bound to the product's free-text `color` column.
  it("renders color as a text input, not a select, for loose stone products", () => {
    render(<ProductForm mode="edit" product={looseStoneProduct} categories={[]} />)
    const colorField = screen.getByLabelText(/color/i)
    expect(colorField.tagName).toBe("INPUT")
    expect(colorField).toHaveAttribute("type", "text")
    expect(colorField).toHaveValue("Pigeon Blood Red")
  })

  it("does not render a colorId select or color options list", () => {
    render(<ProductForm mode="edit" product={looseStoneProduct} categories={[]} />)
    expect(document.querySelector("select#colorId")).toBeNull()
  })

  it("omits the color field entirely for jewellery products", () => {
    const jewelleryProduct = { ...looseStoneProduct, productType: "jewellery" } as unknown as ProductForEdit
    render(<ProductForm mode="edit" product={jewelleryProduct} categories={[]} />)
    expect(screen.queryByLabelText(/^color/i)).toBeNull()
  })
})

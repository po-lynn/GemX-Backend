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

const minProduct = {
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
  imageUrls: [],
  videoUrls: [],
  sellerId: "seller-1",
  sellerName: "Test Seller",
  createdAt: new Date("2026-01-01"),
} as unknown as ProductForEdit

describe("ProductForm nav cluster", () => {
  it("renders prev and next links when both hrefs provided", () => {
    render(
      <ProductForm
        mode="edit"
        product={minProduct}
        categories={[]}
        prevHref="/admin/products/prev-id/edit?page=1"
        nextHref="/admin/products/next-id/edit?page=1"
        listPosition={5}
        listTotal={20}
      />
    )
    const prevLink = screen.getByRole("link", { name: /previous product/i })
    const nextLink = screen.getByRole("link", { name: /next product/i })
    expect(prevLink).toHaveAttribute("href", "/admin/products/prev-id/edit?page=1")
    expect(nextLink).toHaveAttribute("href", "/admin/products/next-id/edit?page=1")
    expect(screen.getByText("5 / 20")).toBeInTheDocument()
  })

  it("omits prev link at list start, shows next link", () => {
    render(
      <ProductForm
        mode="edit"
        product={minProduct}
        categories={[]}
        prevHref={null}
        nextHref="/admin/products/next-id/edit?page=1"
        listPosition={1}
        listTotal={10}
      />
    )
    expect(screen.queryByRole("link", { name: /previous product/i })).toBeNull()
    expect(screen.getByRole("link", { name: /next product/i })).toBeInTheDocument()
  })

  it("omits next link at list end, shows prev link", () => {
    render(
      <ProductForm
        mode="edit"
        product={minProduct}
        categories={[]}
        prevHref="/admin/products/prev-id/edit?page=1"
        nextHref={null}
        listPosition={10}
        listTotal={10}
      />
    )
    expect(screen.getByRole("link", { name: /previous product/i })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /next product/i })).toBeNull()
  })

  it("hides nav cluster entirely when no list context props passed", () => {
    render(<ProductForm mode="edit" product={minProduct} categories={[]} />)
    expect(screen.queryByRole("link", { name: /previous product/i })).toBeNull()
    expect(screen.queryByRole("link", { name: /next product/i })).toBeNull()
    expect(screen.queryByText(/\d+ \/ \d+/)).toBeNull()
  })
})

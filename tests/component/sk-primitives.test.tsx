import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { SkBlock } from "@/components/admin/motion/skeleton/sk-block"
import { SkCard } from "@/components/admin/motion/skeleton/sk-card"
import { SkRow } from "@/components/admin/motion/skeleton/sk-row"
import { SkFormField } from "@/components/admin/motion/skeleton/sk-form-field"

describe("SkBlock", () => {
  it("renders with the sk-shimmer class", () => {
    const { container } = render(<SkBlock w={48} h={12} color="#8b5cf6" />)
    expect(container.firstChild).toHaveClass("sk-shimmer")
  })

  it("applies numeric width and height as px values", () => {
    const { container } = render(<SkBlock w={80} h={20} color="#3b82f6" />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe("80px")
    expect(el.style.height).toBe("20px")
  })

  it("accepts string dimensions", () => {
    const { container } = render(<SkBlock w="100%" h={12} color="#9ca3af" />)
    expect((container.firstChild as HTMLElement).style.width).toBe("100%")
  })

  it("builds backgroundImage using the accent colour as rgb triplet", () => {
    const { container } = render(<SkBlock w={48} h={12} color="#3b82f6" opacity={0.15} />)
    const el = container.firstChild as HTMLElement
    // #3b = 59, #82 = 130, #f6 = 246
    expect(el.style.backgroundImage).toContain("59,130,246")
  })

  it("renders without error when no color prop is given", () => {
    const { container } = render(<SkBlock w={48} h={12} />)
    expect(container.firstChild).toHaveClass("sk-shimmer")
  })
})

describe("SkCard", () => {
  it("renders a card container with 3 shimmer blocks (icon, number, label)", () => {
    const { container } = render(<SkCard accentColor="#8b5cf6" />)
    expect(container.querySelectorAll(".sk-shimmer")).toHaveLength(3)
  })
})

describe("SkRow", () => {
  it("renders shimmer blocks for avatar + name + extra cols", () => {
    const { container } = render(<SkRow cols={5} />)
    // avatar + name + 3 extra = 5 blocks
    expect(container.querySelectorAll(".sk-shimmer")).toHaveLength(5)
  })

  it("renders more blocks when cols is higher", () => {
    const { container: c5 } = render(<SkRow cols={5} />)
    const { container: c7 } = render(<SkRow cols={7} />)
    expect(c7.querySelectorAll(".sk-shimmer").length).toBeGreaterThan(
      c5.querySelectorAll(".sk-shimmer").length
    )
  })
})

describe("SkFormField", () => {
  it("renders exactly 2 shimmer blocks (label + input)", () => {
    const { container } = render(<SkFormField />)
    expect(container.querySelectorAll(".sk-shimmer")).toHaveLength(2)
  })
})

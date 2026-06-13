import { describe, it, expect } from "vitest"
import { springs, variants } from "@/lib/motion-spring"

describe("springs", () => {
  it("entrance has stiffness 200 and damping 20", () => {
    expect(springs.entrance.stiffness).toBe(200)
    expect(springs.entrance.damping).toBe(20)
    expect(springs.entrance.mass).toBe(1)
  })
  it("all spring presets have type spring", () => {
    expect(springs.entrance.type).toBe("spring")
    expect(springs.hover.type).toBe("spring")
    expect(springs.press.type).toBe("spring")
    expect(springs.page.type).toBe("spring")
  })
  it("hover is stiffer than entrance", () => {
    expect(springs.hover.stiffness).toBeGreaterThan(springs.entrance.stiffness)
  })
  it("press is the stiffest preset", () => {
    expect(springs.press.stiffness).toBeGreaterThan(springs.hover.stiffness)
  })
})

describe("variants.fadeUp", () => {
  it("hidden state is invisible with a positive y offset", () => {
    expect(variants.fadeUp.hidden.opacity).toBe(0)
    expect(variants.fadeUp.hidden.y).toBeGreaterThan(0)
    expect(variants.fadeUp.hidden.scale).toBeLessThan(1)
  })
  it("visible state is at natural position", () => {
    expect(variants.fadeUp.visible.opacity).toBe(1)
    expect(variants.fadeUp.visible.y).toBe(0)
    expect(variants.fadeUp.visible.scale).toBe(1)
  })
})

describe("variants.stagger", () => {
  it("visible transition staggers children", () => {
    const t = variants.stagger.visible.transition
    expect(t?.staggerChildren).toBeGreaterThan(0)
  })
})

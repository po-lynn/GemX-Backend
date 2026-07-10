import { describe, it, expect } from "vitest"
import { extractExcerpt } from "@/lib/extract-excerpt"

describe("extractExcerpt", () => {
  // No content at all collapses to an empty string, never a broken excerpt
  it("returns an empty string for empty or invalid content", () => {
    expect(extractExcerpt("[]")).toBe("")
    expect(extractExcerpt(null)).toBe("")
    expect(extractExcerpt("not json")).toBe("")
  })

  // Content shorter than maxLength is returned verbatim, no trailing ellipsis
  it("returns short content verbatim without an ellipsis", () => {
    const content = JSON.stringify([
      { type: "paragraph", content: [{ type: "text", text: "A short intro." }] },
    ])
    expect(extractExcerpt(content)).toBe("A short intro.")
  })

  // Long content is truncated at a word boundary at/under maxLength and ends with an ellipsis
  it("truncates long content at a word boundary and appends an ellipsis", () => {
    const words = Array(60).fill("gemstone").join(" ") // 60 * 9 = 540 chars, well over 155
    const content = JSON.stringify([{ type: "paragraph", content: [{ type: "text", text: words }] }])
    const excerpt = extractExcerpt(content)
    expect(excerpt.length).toBeLessThanOrEqual(156) // 155 + the ellipsis character
    expect(excerpt.endsWith("…")).toBe(true)
    expect(excerpt.endsWith(" …")).toBe(false) // no trailing space before the ellipsis
  })

  // A custom maxLength is respected
  it("respects a custom maxLength", () => {
    const content = JSON.stringify([
      { type: "paragraph", content: [{ type: "text", text: "one two three four five" }] },
    ])
    const excerpt = extractExcerpt(content, 10)
    expect(excerpt.length).toBeLessThanOrEqual(11)
    expect(excerpt.endsWith("…")).toBe(true)
  })
})

import { describe, it, expect } from "vitest"
import { extractPlainText, estimateReadTimeMinutes } from "@/lib/read-time"

const block = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text, styles: {} }],
})

describe("extractPlainText", () => {
  // Validates that text is pulled out of BlockNote JSON block arrays
  it("extracts text from BlockNote paragraph blocks", () => {
    const content = JSON.stringify([block("Hello world"), block("Second paragraph")])
    expect(extractPlainText(content)).toBe("Hello world Second paragraph")
  })

  // Validates that nested children (e.g. list items) are included
  it("extracts text from nested children blocks", () => {
    const content = JSON.stringify([
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "parent" }],
        children: [{ type: "bulletListItem", content: [{ type: "text", text: "child" }] }],
      },
    ])
    expect(extractPlainText(content)).toBe("parent child")
  })

  // Validates graceful handling of non-JSON content (legacy plain text)
  it("returns raw string when content is not JSON", () => {
    expect(extractPlainText("just plain text")).toBe("just plain text")
  })

  // Validates empty input handling
  it("returns empty string for empty content", () => {
    expect(extractPlainText("")).toBe("")
    expect(extractPlainText("[]")).toBe("")
  })
})

describe("estimateReadTimeMinutes", () => {
  // Validates the 200 words-per-minute calculation with rounding up
  it("computes minutes at 200 wpm, rounded up", () => {
    const words = Array.from({ length: 250 }, (_, i) => `word${i}`).join(" ")
    const content = JSON.stringify([block(words)])
    expect(estimateReadTimeMinutes(content)).toBe(2)
  })

  // Validates the 1-minute floor so the UI never shows "0 min"
  it("returns a minimum of 1 minute for short or empty content", () => {
    expect(estimateReadTimeMinutes("[]")).toBe(1)
    expect(estimateReadTimeMinutes(JSON.stringify([block("short")]))).toBe(1)
  })

  // Validates that exactly 200 words is 1 minute (boundary)
  it("returns 1 minute for exactly 200 words", () => {
    const words = Array.from({ length: 200 }, () => "word").join(" ")
    expect(estimateReadTimeMinutes(JSON.stringify([block(words)]))).toBe(1)
  })
})

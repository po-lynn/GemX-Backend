import { describe, it, expect } from "vitest"
import { estimateReadingTime, extractPlainText } from "@/lib/reading-time"

describe("estimateReadingTime", () => {
  // Empty/null content shows a minimal 1-minute estimate instead of 0
  it("returns 0 words and a 1 minute floor for empty content", () => {
    expect(estimateReadingTime(null)).toEqual({ words: 0, minutes: 1 })
    expect(estimateReadingTime("")).toEqual({ words: 0, minutes: 1 })
    expect(estimateReadingTime("[]")).toEqual({ words: 0, minutes: 1 })
  })

  // Malformed JSON must not throw — falls back to the empty estimate
  it("returns the empty estimate for invalid JSON", () => {
    expect(estimateReadingTime("not json")).toEqual({ words: 0, minutes: 1 })
  })

  // Paragraph blocks with inline text runs are counted
  it("counts words from paragraph inline content", () => {
    const content = JSON.stringify([
      { type: "paragraph", content: [{ type: "text", text: "The quick brown fox jumps" }] },
    ])
    expect(estimateReadingTime(content).words).toBe(5)
  })

  // Nested children (e.g. list items) contribute to the word count
  it("counts words inside nested children blocks", () => {
    const content = JSON.stringify([
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "top level" }],
        children: [
          { type: "paragraph", content: [{ type: "text", text: "nested words here" }] },
        ],
      },
    ])
    expect(estimateReadingTime(content).words).toBe(5)
  })

  // Minutes are derived from words-per-minute and always round up to at least 1
  it("derives minutes from the words-per-minute rate", () => {
    const words = Array(400).fill("word").join(" ")
    const content = JSON.stringify([{ type: "paragraph", content: [{ type: "text", text: words }] }])
    expect(estimateReadingTime(content, 200)).toEqual({ words: 400, minutes: 2 })
  })
})

describe("extractPlainText", () => {
  // Empty/null/invalid content all collapse to an empty string
  it("returns an empty string for null, empty, or invalid content", () => {
    expect(extractPlainText(null)).toBe("")
    expect(extractPlainText("")).toBe("")
    expect(extractPlainText("[]")).toBe("")
    expect(extractPlainText("not json")).toBe("")
  })

  // Plain paragraph text is extracted and trimmed
  it("extracts and trims paragraph text", () => {
    const content = JSON.stringify([
      { type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
    ])
    expect(extractPlainText(content)).toBe("Hello world")
  })

  // Nested children (e.g. list items) are included in document order
  it("includes nested children text", () => {
    const content = JSON.stringify([
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "top" }],
        children: [{ type: "paragraph", content: [{ type: "text", text: "nested" }] }],
      },
    ])
    expect(extractPlainText(content)).toContain("top")
    expect(extractPlainText(content)).toContain("nested")
  })
})

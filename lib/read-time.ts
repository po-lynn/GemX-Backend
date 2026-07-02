const WORDS_PER_MINUTE = 200

/** Recursively collect text from BlockNote JSON nodes (blocks, inline content, table cells). */
function collectText(node: unknown, parts: string[]): void {
  if (node == null) return
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, parts)
    return
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>
    if (typeof obj.text === "string") parts.push(obj.text)
    collectText(obj.content, parts)
    collectText(obj.children, parts)
    collectText(obj.rows, parts)
    collectText(obj.cells, parts)
  }
}

/** Extract plain text from BlockNote JSON content. Returns "" on invalid JSON. */
export function extractPlainText(content: string): string {
  if (!content) return ""
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    // Not JSON — treat the raw string as plain text.
    return content
  }
  const parts: string[] = []
  collectText(parsed, parts)
  return parts.join(" ")
}

/** Estimated reading time in whole minutes (minimum 1) at 200 wpm. */
export function estimateReadTimeMinutes(content: string): number {
  const text = extractPlainText(content).trim()
  if (!text) return 1
  const words = text.split(/\s+/).length
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}

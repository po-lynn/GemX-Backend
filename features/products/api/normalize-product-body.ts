/**
 * Normalize JSON API body to form-style shape expected by product create/update schemas.
 * Converts arrays to schema format (jewelleryGemstones → JSON string, imageUrls → newline string).
 */
export function normalizeProductBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") return {}
  const b = body as Record<string, unknown>
  const out = { ...b }
  if (Array.isArray(b.jewelleryGemstones)) {
    out.jewelleryGemstones = JSON.stringify(b.jewelleryGemstones)
  }
  if (Array.isArray(b.imageUrls)) {
    out.imageUrls = (b.imageUrls as string[]).join("\n")
  }
  if (typeof b.price === "number") {
    out.price = String(b.price)
  }
  return out
}

import { normalizeDimensionsField } from "./normalize-dimensions"

/**
 * Normalize JSON API body to form-style shape expected by product create/update schemas.
 * Converts arrays to schema format (jewelleryGemstones → JSON string, imageUrls → newline string).
 * Normalizes `dimensions` (string | array | object) to admin-style `"L × W × D"` text.
 */
export function normalizeProductBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") return {}
  const b = body as Record<string, unknown>
  const out = { ...b }
  if ("dimensions" in out) {
    out.dimensions = normalizeDimensionsField(out.dimensions)
  }
  if (Array.isArray(b.jewelleryGemstones)) {
    const mapped = (b.jewelleryGemstones as Record<string, unknown>[]).map(
      (item) => {
        if (!item || typeof item !== "object") return item
        const row = { ...item }
        if ("dimensions" in row) {
          row.dimensions = normalizeDimensionsField(row.dimensions)
        }
        return row
      }
    )
    out.jewelleryGemstones = JSON.stringify(mapped)
  }
  if (Array.isArray(b.imageUrls)) {
    out.imageUrls = (b.imageUrls as string[]).join("\n")
  }
  if (Array.isArray(b.videoUrls)) {
    out.videoUrls = (b.videoUrls as string[]).join("\n")
  }
  if (typeof b.price === "number") {
    out.price = String(b.price)
  }
  if (typeof b.promotionComparePrice === "number") {
    out.promotionComparePrice = String(b.promotionComparePrice)
  }
  return out
}

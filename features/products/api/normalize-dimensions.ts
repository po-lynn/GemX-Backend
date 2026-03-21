/**
 * Normalizes API `dimensions` input to the same storage format as the admin form:
 * non-empty parts joined with ` × ` (Unicode multiply, spaces around).
 * Parsing elsewhere accepts `x`, `X`, or `×` when splitting.
 */

const DIM_SEP = " × "

export function formatDimensionsParts(parts: string[]): string | null {
  const cleaned = parts.map((p) => String(p).trim()).filter(Boolean)
  return cleaned.length ? cleaned.join(DIM_SEP) : null
}

/**
 * Accepts:
 * - `string` — trimmed as-is (empty → null)
 * - `string[]` — segments joined with ` × ` (empty segments dropped)
 * - `{ length?, width?, depth? }` or `{ length?, width?, height? }` — third axis is `depth` or `height`
 * - `{ part1?, part2?, part3? }` — matches admin three-field layout
 */
export function normalizeDimensionsField(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === "string") {
    const t = value.trim()
    return t === "" ? null : t
  }
  if (Array.isArray(value)) {
    return formatDimensionsParts(value.map((x) => String(x)))
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>
    const hasPart = (k: string) =>
      o[k] != null && String(o[k]).trim() !== ""
    if (hasPart("part1") || hasPart("part2") || hasPart("part3")) {
      return formatDimensionsParts([
        hasPart("part1") ? String(o.part1).trim() : "",
        hasPart("part2") ? String(o.part2).trim() : "",
        hasPart("part3") ? String(o.part3).trim() : "",
      ])
    }
    const L = o.length
    const W = o.width
    const third = o.depth ?? o.height
    if (
      (L != null && String(L).trim()) ||
      (W != null && String(W).trim()) ||
      (third != null && String(third).trim())
    ) {
      return formatDimensionsParts([
        L != null ? String(L).trim() : "",
        W != null ? String(W).trim() : "",
        third != null ? String(third).trim() : "",
      ])
    }
    return null
  }
  return null
}

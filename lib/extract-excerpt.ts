import { extractPlainText } from "@/lib/reading-time";

/** Plain-text excerpt from a BlockNote JSON document, truncated at a word boundary. Empty string for empty/invalid content. */
export function extractExcerpt(contentJson: string | null | undefined, maxLength = 155): string {
  const text = extractPlainText(contentJson);
  if (!text) return "";
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  const base = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  return `${base}…`;
}

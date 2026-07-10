type BlockNoteInline = { text?: unknown; content?: unknown };
type BlockNoteBlock = { content?: unknown; children?: unknown };

function extractInlineText(items: unknown): string {
  if (!Array.isArray(items)) return "";
  let out = "";
  for (const raw of items) {
    const item = raw as BlockNoteInline;
    if (typeof item?.text === "string") out += item.text + " ";
    if (Array.isArray(item?.content)) out += extractInlineText(item.content) + " ";
  }
  return out;
}

function extractBlockText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  let out = "";
  for (const raw of blocks) {
    const block = raw as BlockNoteBlock;
    if (typeof block?.content === "string") out += block.content + " ";
    else if (Array.isArray(block?.content)) out += extractInlineText(block.content) + " ";
    if (Array.isArray(block?.children)) out += extractBlockText(block.children) + " ";
  }
  return out;
}

/** Plain, trimmed text pulled from a BlockNote JSON document. Empty string for null/empty/invalid input. */
export function extractPlainText(contentJson: string | null | undefined): string {
  if (!contentJson) return "";
  let blocks: unknown;
  try {
    blocks = JSON.parse(contentJson);
  } catch {
    return "";
  }
  return extractBlockText(blocks).trim();
}

export type ReadingTime = { words: number; minutes: number };

/** Cosmetic word/read-time estimate from a BlockNote JSON document. Never persisted. */
export function estimateReadingTime(contentJson: string | null | undefined, wordsPerMinute = 200): ReadingTime {
  const text = extractPlainText(contentJson);
  const words = text.length ? text.split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.round(words / wordsPerMinute));
  return { words, minutes };
}

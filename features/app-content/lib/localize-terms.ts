import type { MultilangBlockNoteContent } from "@/features/app-content/schemas/app-content"
import {
  detectNewsLanguage,
  isGoogleTranslateConfigured,
  translateBlockNoteContent,
  type NewsLanguage,
} from "@/features/content/services/google-translate"

/** Collect text/caption strings from BlockNote JSON for language detection. */
export function extractBlockNotePlainText(contentJson: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(contentJson || "[]")
  } catch {
    return ""
  }
  const bag: string[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    if (!node || typeof node !== "object") return
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if ((key === "text" || key === "caption") && typeof value === "string" && value.trim()) {
        bag.push(value)
      } else {
        walk(value)
      }
    }
  }
  walk(parsed)
  return bag.join(" ").trim()
}

/**
 * When the admin saved English BlockNote content, detect language and (if English)
 * translate into Myanmar, Thai, and Korean.
 */
export async function localizeMultilangBlockNoteIfEnglish(
  content: MultilangBlockNoteContent,
  translateFromEnglish: boolean,
  sectionLabel = "content",
): Promise<MultilangBlockNoteContent> {
  if (!translateFromEnglish) return content

  const plain = extractBlockNotePlainText(content.contentEn)
  if (!plain) {
    return { ...content, sourceLanguage: "English" }
  }

  const detected: NewsLanguage = await detectNewsLanguage(plain)
  if (detected !== "English") {
    return { ...content, sourceLanguage: detected }
  }

  if (!isGoogleTranslateConfigured()) {
    throw new Error(
      `Google Translate is not configured. Set GOOGLE_TRANSLATE_API_KEY to auto-translate ${sectionLabel}.`,
    )
  }

  const [contentMy, contentTh, contentKo] = await Promise.all([
    translateBlockNoteContent(content.contentEn, "English", "Myanmar"),
    translateBlockNoteContent(content.contentEn, "English", "Thai"),
    translateBlockNoteContent(content.contentEn, "English", "Korean"),
  ])

  return {
    contentEn: content.contentEn,
    contentMy,
    contentTh,
    contentKo,
    sourceLanguage: "English",
  }
}

/** @deprecated Prefer localizeMultilangBlockNoteIfEnglish */
export async function localizeTermsConditionsIfEnglish(
  content: MultilangBlockNoteContent,
  translateFromEnglish: boolean,
): Promise<MultilangBlockNoteContent> {
  return localizeMultilangBlockNoteIfEnglish(
    content,
    translateFromEnglish,
    "Terms & Conditions",
  )
}

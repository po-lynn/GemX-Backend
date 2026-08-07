/**
 * Google Cloud Translation API (v2) for news title + content localization.
 * Supported locales: English, Myanmar, Thai, Korean.
 */

export const NEWS_LANGUAGES = ["English", "Myanmar", "Thai", "Korean"] as const
export type NewsLanguage = (typeof NEWS_LANGUAGES)[number]

export const GOOGLE_LANG_BY_NEWS: Record<NewsLanguage, string> = {
  English: "en",
  Myanmar: "my",
  Thai: "th",
  Korean: "ko",
}

const NEWS_BY_GOOGLE: Record<string, NewsLanguage> = {
  en: "English",
  my: "Myanmar",
  bur: "Myanmar",
  th: "Thai",
  ko: "Korean",
}

export type LocalizedNewsPayload = {
  sourceLanguage: NewsLanguage
  title: string
  titleEn: string
  titleMy: string
  titleTh: string
  titleKo: string
  content: string
  contentEn: string
  contentMy: string
  contentTh: string
  contentKo: string
}

function getApiKey(): string | null {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY?.trim()
  return key || null
}

export function isGoogleTranslateConfigured(): boolean {
  return getApiKey() !== null
}

/** Script heuristic when Google detect is unavailable. */
export function detectNewsLanguageFromScript(text: string): NewsLanguage {
  const sample = text.slice(0, 400)
  let myanmar = 0
  let thai = 0
  let korean = 0
  let latin = 0
  for (const ch of sample) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0x1000 && code <= 0x109f) myanmar++
    else if (code >= 0x0e00 && code <= 0x0e7f) thai++
    else if (
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0x1100 && code <= 0x11ff) ||
      (code >= 0x3130 && code <= 0x318f)
    ) {
      korean++
    } else if (
      (code >= 0x0041 && code <= 0x007a) ||
      (code >= 0x00c0 && code <= 0x024f)
    ) {
      latin++
    }
  }
  const max = Math.max(myanmar, thai, korean, latin)
  if (max === 0) return "English"
  if (myanmar === max) return "Myanmar"
  if (thai === max) return "Thai"
  if (korean === max) return "Korean"
  return "English"
}

type DetectResponse = {
  data?: { detections?: Array<Array<{ language: string }>> }
  error?: { message?: string }
}

type TranslateResponse = {
  data?: { translations?: Array<{ translatedText: string }> }
  error?: { message?: string }
}

async function googlePost<T>(path: string, body: unknown): Promise<T> {
  const key = getApiKey()
  if (!key) {
    throw new Error(
      "Google Translate is not configured. Set GOOGLE_TRANSLATE_API_KEY in .env.local.",
    )
  }
  const url = `https://translation.googleapis.com/language/translate/v2${path}?key=${encodeURIComponent(key)}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as T & { error?: { message?: string } }
  if (!res.ok || json.error) {
    throw new Error(
      `Google Translate failed (${res.status}): ${json.error?.message ?? res.statusText}`,
    )
  }
  return json
}

export async function detectNewsLanguage(title: string): Promise<NewsLanguage> {
  const trimmed = title.trim()
  if (!trimmed) return "English"
  if (!isGoogleTranslateConfigured()) {
    return detectNewsLanguageFromScript(trimmed)
  }
  try {
    const result = await googlePost<DetectResponse>("/detect", { q: trimmed })
    const code = result.data?.detections?.[0]?.[0]?.language?.toLowerCase()
    if (code && NEWS_BY_GOOGLE[code]) return NEWS_BY_GOOGLE[code]
  } catch {
    // fall through
  }
  return detectNewsLanguageFromScript(trimmed)
}

/** Translate one or more strings from → to. */
export async function translateTexts(
  texts: string[],
  from: NewsLanguage,
  to: NewsLanguage,
): Promise<string[]> {
  if (from === to || texts.length === 0) return texts
  const nonEmptyIdx: number[] = []
  const payload: string[] = []
  for (let i = 0; i < texts.length; i++) {
    if (texts[i]!.trim()) {
      nonEmptyIdx.push(i)
      payload.push(texts[i]!)
    }
  }
  if (payload.length === 0) return texts

  const result = await googlePost<TranslateResponse>("", {
    q: payload,
    source: GOOGLE_LANG_BY_NEWS[from],
    target: GOOGLE_LANG_BY_NEWS[to],
    format: "text",
  })
  const translated = result.data?.translations?.map((t) => t.translatedText) ?? []
  const out = [...texts]
  for (let j = 0; j < nonEmptyIdx.length; j++) {
    out[nonEmptyIdx[j]!] = translated[j] ?? texts[nonEmptyIdx[j]!]!
  }
  return out
}

export async function translateText(
  text: string,
  from: NewsLanguage,
  to: NewsLanguage,
): Promise<string> {
  const [out] = await translateTexts([text], from, to)
  return out ?? text
}

function collectTranslatableStrings(node: unknown, bag: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectTranslatableStrings(item, bag)
    return
  }
  if (!node || typeof node !== "object") return
  const obj = node as Record<string, unknown>
  for (const [key, value] of Object.entries(obj)) {
    if ((key === "text" || key === "caption") && typeof value === "string" && value.trim()) {
      bag.push(value)
    } else {
      collectTranslatableStrings(value, bag)
    }
  }
}

function applyTranslatedStrings(
  node: unknown,
  queue: string[],
  cursor: { i: number },
): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => applyTranslatedStrings(item, queue, cursor))
  }
  if (!node || typeof node !== "object") return node
  const obj = node as Record<string, unknown>
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if ((key === "text" || key === "caption") && typeof value === "string" && value.trim()) {
      next[key] = queue[cursor.i++] ?? value
    } else {
      next[key] = applyTranslatedStrings(value, queue, cursor)
    }
  }
  return next
}

/** Translate BlockNote JSON by batching text/caption fields. */
export async function translateBlockNoteContent(
  contentJson: string,
  from: NewsLanguage,
  to: NewsLanguage,
): Promise<string> {
  if (from === to) return contentJson
  let parsed: unknown
  try {
    parsed = JSON.parse(contentJson || "[]")
  } catch {
    return contentJson
  }
  const strings: string[] = []
  collectTranslatableStrings(parsed, strings)
  if (strings.length === 0) return contentJson
  const translated = await translateTexts(strings, from, to)
  const rebuilt = applyTranslatedStrings(parsed, translated, { i: 0 })
  return JSON.stringify(rebuilt)
}

/**
 * Detect title language (or use override), then fill all four title + content columns.
 */
export async function buildLocalizedNews(
  title: string,
  content: string,
  sourceOverride?: NewsLanguage,
): Promise<LocalizedNewsPayload> {
  if (!isGoogleTranslateConfigured()) {
    throw new Error(
      "Google Translate is not configured. Set GOOGLE_TRANSLATE_API_KEY to auto-translate news.",
    )
  }

  const sourceLanguage = sourceOverride ?? (await detectNewsLanguage(title))
  const targets = NEWS_LANGUAGES.filter((l) => l !== sourceLanguage)

  const titleByLang: Partial<Record<NewsLanguage, string>> = {
    [sourceLanguage]: title,
  }
  const contentByLang: Partial<Record<NewsLanguage, string>> = {
    [sourceLanguage]: content,
  }

  await Promise.all(
    targets.map(async (lang) => {
      const [t, c] = await Promise.all([
        translateText(title, sourceLanguage, lang),
        translateBlockNoteContent(content, sourceLanguage, lang),
      ])
      titleByLang[lang] = t
      contentByLang[lang] = c
    }),
  )

  return {
    sourceLanguage,
    title,
    titleEn: titleByLang.English ?? title,
    titleMy: titleByLang.Myanmar ?? title,
    titleTh: titleByLang.Thai ?? title,
    titleKo: titleByLang.Korean ?? title,
    content,
    contentEn: contentByLang.English ?? content,
    contentMy: contentByLang.Myanmar ?? content,
    contentTh: contentByLang.Thai ?? content,
    contentKo: contentByLang.Korean ?? content,
  }
}

export function pickLocalizedTitle(
  row: {
    title: string
    titleEn?: string | null
    titleMy?: string | null
    titleTh?: string | null
    titleKo?: string | null
  },
  lang?: NewsLanguage,
): string {
  if (!lang) return row.title
  const map: Record<NewsLanguage, string | null | undefined> = {
    English: row.titleEn,
    Myanmar: row.titleMy,
    Thai: row.titleTh,
    Korean: row.titleKo,
  }
  return map[lang]?.trim() || row.title
}

export function pickLocalizedContent(
  row: {
    content: string
    contentEn?: string | null
    contentMy?: string | null
    contentTh?: string | null
    contentKo?: string | null
  },
  lang?: NewsLanguage,
): string {
  if (!lang) return row.content
  const map: Record<NewsLanguage, string | null | undefined> = {
    English: row.contentEn,
    Myanmar: row.contentMy,
    Thai: row.contentTh,
    Korean: row.contentKo,
  }
  return map[lang]?.trim() || row.content
}

/** Map an edited locale's title/content onto the news row columns. */
export function localizedFieldsForLanguage(
  lang: NewsLanguage,
  title: string,
  content: string,
  sourceLanguage?: string | null,
): {
  titleEn?: string
  titleMy?: string
  titleTh?: string
  titleKo?: string
  contentEn?: string
  contentMy?: string
  contentTh?: string
  contentKo?: string
  title?: string
  content?: string
} {
  const fields: ReturnType<typeof localizedFieldsForLanguage> = {}
  if (lang === "English") {
    fields.titleEn = title
    fields.contentEn = content
  } else if (lang === "Myanmar") {
    fields.titleMy = title
    fields.contentMy = content
  } else if (lang === "Thai") {
    fields.titleTh = title
    fields.contentTh = content
  } else {
    fields.titleKo = title
    fields.contentKo = content
  }
  // Keep canonical title/content in sync when editing the source language.
  if (sourceLanguage === lang || (!sourceLanguage && lang === "English")) {
    fields.title = title
    fields.content = content
  }
  return fields
}

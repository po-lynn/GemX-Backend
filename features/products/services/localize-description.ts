/**
 * Product title + description localization via Google Cloud Translation API.
 * Reuses detect + translate helpers from news (English / Myanmar / Thai / Korean).
 */

import {
  NEWS_LANGUAGES,
  detectNewsLanguage,
  isGoogleTranslateConfigured,
  translateText,
  type NewsLanguage,
} from "@/features/news/services/google-translate"

export type ProductLanguage = NewsLanguage
export { NEWS_LANGUAGES as PRODUCT_LANGUAGES }

export type LocalizedProductTitle = {
  sourceLanguage: ProductLanguage
  title: string
  titleEn: string
  titleMy: string
  titleTh: string
  titleKo: string
}

export type LocalizedProductDescription = {
  sourceLanguage: ProductLanguage
  description: string
  descriptionEn: string
  descriptionMy: string
  descriptionTh: string
  descriptionKo: string
}

/**
 * Detect title language, then translate into the other three locales.
 * Title is required for create — empty/whitespace throws after config check is skipped.
 */
export async function buildLocalizedProductTitle(
  title: string,
): Promise<LocalizedProductTitle> {
  const trimmed = title.trim()
  if (!trimmed) {
    throw new Error("Product title is required for translation.")
  }

  if (!isGoogleTranslateConfigured()) {
    throw new Error(
      "Google Translate is not configured. Set GOOGLE_TRANSLATE_API_KEY to auto-translate product titles.",
    )
  }

  const sourceLanguage = await detectNewsLanguage(trimmed)
  const targets = NEWS_LANGUAGES.filter((l) => l !== sourceLanguage)
  const byLang: Partial<Record<NewsLanguage, string>> = {
    [sourceLanguage]: trimmed,
  }

  await Promise.all(
    targets.map(async (lang) => {
      byLang[lang] = await translateText(trimmed, sourceLanguage, lang)
    }),
  )

  return {
    sourceLanguage,
    title: trimmed,
    titleEn: byLang.English ?? trimmed,
    titleMy: byLang.Myanmar ?? trimmed,
    titleTh: byLang.Thai ?? trimmed,
    titleKo: byLang.Korean ?? trimmed,
  }
}

/**
 * Detect description language, then translate into the other three locales.
 * Empty/whitespace description → English source with empty localized fields (no API calls).
 */
export async function buildLocalizedProductDescription(
  description: string,
): Promise<LocalizedProductDescription> {
  const trimmed = description.trim()
  if (!trimmed) {
    return {
      sourceLanguage: "English",
      description: "",
      descriptionEn: "",
      descriptionMy: "",
      descriptionTh: "",
      descriptionKo: "",
    }
  }

  if (!isGoogleTranslateConfigured()) {
    throw new Error(
      "Google Translate is not configured. Set GOOGLE_TRANSLATE_API_KEY to auto-translate product descriptions.",
    )
  }

  const sourceLanguage = await detectNewsLanguage(trimmed)
  const targets = NEWS_LANGUAGES.filter((l) => l !== sourceLanguage)
  const byLang: Partial<Record<NewsLanguage, string>> = {
    [sourceLanguage]: trimmed,
  }

  await Promise.all(
    targets.map(async (lang) => {
      byLang[lang] = await translateText(trimmed, sourceLanguage, lang)
    }),
  )

  return {
    sourceLanguage,
    description: trimmed,
    descriptionEn: byLang.English ?? trimmed,
    descriptionMy: byLang.Myanmar ?? trimmed,
    descriptionTh: byLang.Thai ?? trimmed,
    descriptionKo: byLang.Korean ?? trimmed,
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
  lang?: ProductLanguage,
): string {
  if (!lang) return row.title
  const map: Record<ProductLanguage, string | null | undefined> = {
    English: row.titleEn,
    Myanmar: row.titleMy,
    Thai: row.titleTh,
    Korean: row.titleKo,
  }
  return map[lang]?.trim() || row.title
}

export function pickLocalizedDescription(
  row: {
    description: string | null
    descriptionEn?: string | null
    descriptionMy?: string | null
    descriptionTh?: string | null
    descriptionKo?: string | null
  },
  lang?: ProductLanguage,
): string | null {
  if (!lang) return row.description
  const map: Record<ProductLanguage, string | null | undefined> = {
    English: row.descriptionEn,
    Myanmar: row.descriptionMy,
    Thai: row.descriptionTh,
    Korean: row.descriptionKo,
  }
  const picked = map[lang]?.trim()
  return picked || row.description
}

/** Map an edited locale's title onto the product row columns (no re-translate). */
export function localizedTitleFieldsForLanguage(
  lang: ProductLanguage,
  title: string,
  sourceLanguage?: string | null,
): {
  titleEn?: string
  titleMy?: string
  titleTh?: string
  titleKo?: string
  title?: string
} {
  const fields: ReturnType<typeof localizedTitleFieldsForLanguage> = {}
  if (lang === "English") {
    fields.titleEn = title
  } else if (lang === "Myanmar") {
    fields.titleMy = title
  } else if (lang === "Thai") {
    fields.titleTh = title
  } else {
    fields.titleKo = title
  }
  // Keep canonical title in sync when editing the source language.
  if (sourceLanguage === lang || (!sourceLanguage && lang === "English")) {
    fields.title = title
  }
  return fields
}

/** Map an edited locale's description onto the product row columns (no re-translate). */
export function localizedDescriptionFieldsForLanguage(
  lang: ProductLanguage,
  description: string,
  sourceLanguage?: string | null,
): {
  descriptionEn?: string
  descriptionMy?: string
  descriptionTh?: string
  descriptionKo?: string
  description?: string
} {
  const fields: ReturnType<typeof localizedDescriptionFieldsForLanguage> = {}
  if (lang === "English") {
    fields.descriptionEn = description
  } else if (lang === "Myanmar") {
    fields.descriptionMy = description
  } else if (lang === "Thai") {
    fields.descriptionTh = description
  } else {
    fields.descriptionKo = description
  }
  // Keep canonical description in sync when editing the source language.
  if (sourceLanguage === lang || (!sourceLanguage && lang === "English")) {
    fields.description = description
  }
  return fields
}

export function isProductLanguage(
  value: string | null | undefined,
): value is ProductLanguage {
  return !!value && (NEWS_LANGUAGES as readonly string[]).includes(value)
}

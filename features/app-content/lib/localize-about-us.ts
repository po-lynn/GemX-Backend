import type { AboutUsContent } from "@/features/app-content/schemas/app-content"
import {
  detectNewsLanguage,
  isGoogleTranslateConfigured,
  translateTexts,
  type NewsLanguage,
} from "@/features/content/services/google-translate"

type TranslatableField = "storyHeading" | "storyBody" | "companyName" | "contactAddress"

const FIELDS: TranslatableField[] = [
  "storyHeading",
  "storyBody",
  "companyName",
  "contactAddress",
]

type LocaleSuffix = "En" | "My" | "Th" | "Ko"

function localeSuffix(lang: NewsLanguage): LocaleSuffix {
  if (lang === "English") return "En"
  if (lang === "Myanmar") return "My"
  if (lang === "Thai") return "Th"
  return "Ko"
}

type LocalizedStringKey =
  | "storyHeadingEn"
  | "storyHeadingMy"
  | "storyHeadingTh"
  | "storyHeadingKo"
  | "storyBodyEn"
  | "storyBodyMy"
  | "storyBodyTh"
  | "storyBodyKo"
  | "companyNameEn"
  | "companyNameMy"
  | "companyNameTh"
  | "companyNameKo"
  | "contactAddressEn"
  | "contactAddressMy"
  | "contactAddressTh"
  | "contactAddressKo"

function fieldKey(field: TranslatableField, lang: NewsLanguage): LocalizedStringKey {
  return `${field}${localeSuffix(lang)}` as LocalizedStringKey
}

/** Read a localized string field; fall back to English when empty. */
export function pickAboutUsField(
  content: AboutUsContent,
  field: TranslatableField,
  lang: NewsLanguage,
): string {
  const localized = content[fieldKey(field, lang)].trim()
  if (localized) return content[fieldKey(field, lang)]
  return content[fieldKey(field, "English")]
}

/** Localized About Us strings for a mobile `lang` query (falls back to English). */
export function pickAboutUsLocalized(
  content: AboutUsContent,
  lang: NewsLanguage,
): {
  storyHeading: string
  storyBody: string
  companyName: string
  contactAddress: string
} {
  return {
    storyHeading: pickAboutUsField(content, "storyHeading", lang),
    storyBody: pickAboutUsField(content, "storyBody", lang),
    companyName: pickAboutUsField(content, "companyName", lang),
    contactAddress: pickAboutUsField(content, "contactAddress", lang),
  }
}

/**
 * When the admin saved English About Us fields, detect language and (if English)
 * translate storyHeading / storyBody / companyName / contactAddress into MY/TH/KO.
 */
export async function localizeAboutUsIfEnglish(
  content: AboutUsContent,
  translateFromEnglish: boolean,
): Promise<AboutUsContent> {
  if (!translateFromEnglish) return content

  const enTexts = FIELDS.map((field) => content[fieldKey(field, "English")])
  const plain = enTexts.map((t) => t.trim()).filter(Boolean).join(" ")
  if (!plain) {
    return { ...content, sourceLanguage: "English" }
  }

  const detected: NewsLanguage = await detectNewsLanguage(plain)
  if (detected !== "English") {
    return { ...content, sourceLanguage: detected }
  }

  if (!isGoogleTranslateConfigured()) {
    throw new Error(
      "Google Translate is not configured. Set GOOGLE_TRANSLATE_API_KEY to auto-translate About Us.",
    )
  }

  const [myTexts, thTexts, koTexts] = await Promise.all([
    translateTexts(enTexts, "English", "Myanmar"),
    translateTexts(enTexts, "English", "Thai"),
    translateTexts(enTexts, "English", "Korean"),
  ])

  const next = { ...content, sourceLanguage: "English" as const }
  for (let i = 0; i < FIELDS.length; i++) {
    const field = FIELDS[i]!
    next[fieldKey(field, "Myanmar")] = myTexts[i] ?? ""
    next[fieldKey(field, "Thai")] = thTexts[i] ?? ""
    next[fieldKey(field, "Korean")] = koTexts[i] ?? ""
  }
  return next
}

/**
 * Migrate legacy monolingual About Us jsonb (`storyHeading`, etc.) into
 * multilang En/My/Th/Ko fields. Safe to call repeatedly.
 */
export function normalizeAboutUsContent(
  raw: unknown,
  defaults: AboutUsContent,
): AboutUsContent {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}

  const str = (key: string, fallback = ""): string => {
    const v = obj[key]
    return typeof v === "string" ? v : fallback
  }

  const legacyHeading = str("storyHeading")
  const legacyBody = str("storyBody")
  const legacyCompany = str("companyName")
  const legacyAddress = str("contactAddress")

  const sourceRaw = str("sourceLanguage", "English")
  const sourceLanguage =
    sourceRaw === "Myanmar" || sourceRaw === "Thai" || sourceRaw === "Korean"
      ? sourceRaw
      : "English"

  return {
    ...defaults,
    storyHeadingEn: str("storyHeadingEn", legacyHeading || defaults.storyHeadingEn),
    storyHeadingMy: str("storyHeadingMy", ""),
    storyHeadingTh: str("storyHeadingTh", ""),
    storyHeadingKo: str("storyHeadingKo", ""),
    storyBodyEn: str("storyBodyEn", legacyBody || defaults.storyBodyEn),
    storyBodyMy: str("storyBodyMy", ""),
    storyBodyTh: str("storyBodyTh", ""),
    storyBodyKo: str("storyBodyKo", ""),
    companyNameEn: str("companyNameEn", legacyCompany || defaults.companyNameEn),
    companyNameMy: str("companyNameMy", ""),
    companyNameTh: str("companyNameTh", ""),
    companyNameKo: str("companyNameKo", ""),
    contactAddressEn: str("contactAddressEn", legacyAddress || defaults.contactAddressEn),
    contactAddressMy: str("contactAddressMy", ""),
    contactAddressTh: str("contactAddressTh", ""),
    contactAddressKo: str("contactAddressKo", ""),
    sourceLanguage,
    termsSlug: str("termsSlug", defaults.termsSlug),
    termsUpdatedAt:
      obj.termsUpdatedAt === null
        ? null
        : typeof obj.termsUpdatedAt === "string"
          ? obj.termsUpdatedAt
          : defaults.termsUpdatedAt,
    privacySlug: str("privacySlug", defaults.privacySlug),
    privacyUpdatedAt:
      obj.privacyUpdatedAt === null
        ? null
        : typeof obj.privacyUpdatedAt === "string"
          ? obj.privacyUpdatedAt
          : defaults.privacyUpdatedAt,
    appVersion: str("appVersion", defaults.appVersion),
  }
}

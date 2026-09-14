import { NextRequest, connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getCachedPublishedAboutUs } from "@/features/app-content/db/cache/app-content"
import { pickAboutUsLocalized } from "@/features/app-content/lib/localize-about-us"
import type { NewsLanguage } from "@/features/content/services/google-translate"

const LANG_QUERY: Record<string, NewsLanguage> = {
  english: "English",
  en: "English",
  myanmar: "Myanmar",
  my: "Myanmar",
  burmese: "Myanmar",
  thai: "Thai",
  th: "Thai",
  korean: "Korean",
  ko: "Korean",
}

/** Public read-only About Us content for the mobile app. No auth required. */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const content = await getCachedPublishedAboutUs()
    const langParam = request.nextUrl.searchParams.get("lang")?.trim().toLowerCase() ?? ""
    const lang = LANG_QUERY[langParam]
    const resolvedLang = lang ?? "English"
    const localized = pickAboutUsLocalized(content, resolvedLang)

    return jsonCached({
      ...localized,
      storyHeadingEn: content.storyHeadingEn,
      storyHeadingMy: content.storyHeadingMy,
      storyHeadingTh: content.storyHeadingTh,
      storyHeadingKo: content.storyHeadingKo,
      storyBodyEn: content.storyBodyEn,
      storyBodyMy: content.storyBodyMy,
      storyBodyTh: content.storyBodyTh,
      storyBodyKo: content.storyBodyKo,
      companyNameEn: content.companyNameEn,
      companyNameMy: content.companyNameMy,
      companyNameTh: content.companyNameTh,
      companyNameKo: content.companyNameKo,
      contactAddressEn: content.contactAddressEn,
      contactAddressMy: content.contactAddressMy,
      contactAddressTh: content.contactAddressTh,
      contactAddressKo: content.contactAddressKo,
      sourceLanguage: content.sourceLanguage,
      lang: lang ?? null,
      termsSlug: content.termsSlug,
      termsUpdatedAt: content.termsUpdatedAt,
      privacySlug: content.privacySlug,
      privacyUpdatedAt: content.privacyUpdatedAt,
      appVersion: content.appVersion,
    })
  } catch (e) {
    console.error("GET /api/mobile/about-us:", e)
    return jsonError("Failed to load about us content", 500)
  }
}

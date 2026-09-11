import { NextRequest } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import type { MultilangBlockNoteContent } from "@/features/app-content/schemas/app-content"
import {
  pickLocalizedContent,
  type NewsLanguage,
} from "@/features/content/services/google-translate"

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

export async function multilangBlockNoteMobileGet(
  request: NextRequest,
  opts: {
    load: () => Promise<MultilangBlockNoteContent>
    errorMessage: string
    logLabel: string
  },
) {
  try {
    const content = await opts.load()
    const langParam = request.nextUrl.searchParams.get("lang")?.trim().toLowerCase() ?? ""
    const lang = LANG_QUERY[langParam]

    const localized = pickLocalizedContent(
      {
        content: content.contentEn || "[]",
        contentEn: content.contentEn,
        contentMy: content.contentMy,
        contentTh: content.contentTh,
        contentKo: content.contentKo,
      },
      lang ?? "English",
    )

    return jsonCached({
      content: localized,
      contentEn: content.contentEn,
      contentMy: content.contentMy,
      contentTh: content.contentTh,
      contentKo: content.contentKo,
      sourceLanguage: content.sourceLanguage,
      lang: lang ?? null,
    })
  } catch (e) {
    console.error(`${opts.logLabel}:`, e)
    return jsonError(opts.errorMessage, 500)
  }
}

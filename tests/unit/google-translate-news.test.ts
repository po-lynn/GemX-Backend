import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  detectNewsLanguageFromScript,
  GOOGLE_LANG_BY_NEWS,
  pickLocalizedTitle,
  pickLocalizedContent,
} from "@/features/news/services/google-translate"

describe("detectNewsLanguageFromScript", () => {
  it("detects English from Latin script", () => {
    expect(detectNewsLanguageFromScript("Ruby market update")).toBe("English")
  })

  it("detects Myanmar from Myanmar script", () => {
    expect(detectNewsLanguageFromScript("ကျောက်မျက်ဈေးကွက်")).toBe("Myanmar")
  })

  it("detects Thai from Thai script", () => {
    expect(detectNewsLanguageFromScript("ตลาดอัญมณี")).toBe("Thai")
  })

  it("detects Korean from Hangul", () => {
    expect(detectNewsLanguageFromScript("보석 시장 업데이트")).toBe("Korean")
  })
})

describe("GOOGLE_LANG_BY_NEWS", () => {
  it("maps display names to Google language codes", () => {
    expect(GOOGLE_LANG_BY_NEWS.English).toBe("en")
    expect(GOOGLE_LANG_BY_NEWS.Myanmar).toBe("my")
    expect(GOOGLE_LANG_BY_NEWS.Thai).toBe("th")
    expect(GOOGLE_LANG_BY_NEWS.Korean).toBe("ko")
  })
})

describe("pickLocalizedTitle / pickLocalizedContent", () => {
  const row = {
    title: "Original",
    titleEn: "English title",
    titleMy: "မြန်မာ",
    titleTh: "ไทย",
    titleKo: "한국어",
    content: "[]",
    contentEn: '[{"t":"en"}]',
    contentMy: '[{"t":"my"}]',
    contentTh: '[{"t":"th"}]',
    contentKo: '[{"t":"ko"}]',
  }

  it("returns original fields when lang is omitted", () => {
    expect(pickLocalizedTitle(row)).toBe("Original")
    expect(pickLocalizedContent(row)).toBe("[]")
  })

  it("returns localized columns for the requested lang", () => {
    expect(pickLocalizedTitle(row, "Thai")).toBe("ไทย")
    expect(pickLocalizedContent(row, "Korean")).toBe('[{"t":"ko"}]')
  })
})

describe("localizedFieldsForLanguage", () => {
  // Non-source language only updates that locale's columns
  it("maps Thai edits to titleTh/contentTh without touching canonical fields", async () => {
    const { localizedFieldsForLanguage } = await import(
      "@/features/news/services/google-translate"
    )
    expect(
      localizedFieldsForLanguage("Thai", "หัวข้อ", "[]", "English"),
    ).toEqual({ titleTh: "หัวข้อ", contentTh: "[]" })
  })

  // Source language also updates title/content
  it("also sets title/content when editing the source language", async () => {
    const { localizedFieldsForLanguage } = await import(
      "@/features/news/services/google-translate"
    )
    expect(
      localizedFieldsForLanguage("Myanmar", "ခေါင်းစဉ်", "[1]", "Myanmar"),
    ).toEqual({
      titleMy: "ခေါင်းစဉ်",
      contentMy: "[1]",
      title: "ခေါင်းစဉ်",
      content: "[1]",
    })
  })
})

describe("buildLocalizedNews", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.GOOGLE_TRANSLATE_API_KEY = "test-key"
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.GOOGLE_TRANSLATE_API_KEY
  })

  it("detects English and fills title+content for the other three languages", async () => {
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (u.includes("/detect")) {
        return new Response(
          JSON.stringify({ data: { detections: [[{ language: "en" }]] } }),
          { status: 200 },
        )
      }
      const target = body.target as string
      const q = Array.isArray(body.q) ? body.q : [body.q]
      const map: Record<string, string> = {
        my: "MY:",
        th: "TH:",
        ko: "KO:",
      }
      const prefix = map[target] ?? ""
      return new Response(
        JSON.stringify({
          data: {
            translations: q.map((text: string) => ({
              translatedText: `${prefix}${text}`,
            })),
          },
        }),
        { status: 200 },
      )
    }) as unknown as typeof fetch

    const { buildLocalizedNews } = await import(
      "@/features/news/services/google-translate"
    )
    const content = JSON.stringify([
      { type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
    ])
    const result = await buildLocalizedNews("Market update", content)

    expect(result.sourceLanguage).toBe("English")
    expect(result.titleEn).toBe("Market update")
    expect(result.titleMy).toBe("MY:Market update")
    expect(result.titleTh).toBe("TH:Market update")
    expect(result.titleKo).toBe("KO:Market update")
    expect(result.contentEn).toBe(content)
    expect(result.contentMy).toContain("MY:Hello world")
    expect(result.contentTh).toContain("TH:Hello world")
    expect(result.contentKo).toContain("KO:Hello world")
  })

  it("throws when GOOGLE_TRANSLATE_API_KEY is missing", async () => {
    delete process.env.GOOGLE_TRANSLATE_API_KEY
    const { buildLocalizedNews } = await import(
      "@/features/news/services/google-translate"
    )
    await expect(buildLocalizedNews("Hello", "[]")).rejects.toThrow(
      /GOOGLE_TRANSLATE_API_KEY/,
    )
  })
})

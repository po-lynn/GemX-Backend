import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  localizeAboutUsIfEnglish,
  normalizeAboutUsContent,
  pickAboutUsLocalized,
} from "@/features/app-content/lib/localize-about-us"
import { DEFAULT_ABOUT_US_CONTENT } from "@/features/app-content/db/app-content"
import {
  detectNewsLanguage,
  isGoogleTranslateConfigured,
  translateTexts,
} from "@/features/content/services/google-translate"

vi.mock("@/features/content/services/google-translate", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/content/services/google-translate")
  >("@/features/content/services/google-translate")
  return {
    ...actual,
    detectNewsLanguage: vi.fn(),
    isGoogleTranslateConfigured: vi.fn(),
    translateTexts: vi.fn(),
  }
})

const EN_CONTENT = {
  ...DEFAULT_ABOUT_US_CONTENT,
  storyHeadingEn: "Our Story",
  storyBodyEn: "GemX began in 2019.",
  companyNameEn: "GemX Ltd.",
  contactAddressEn: "Yangon",
}

describe("normalizeAboutUsContent", () => {
  // Legacy monolingual jsonb must map into *En fields without data loss.
  it("migrates legacy storyHeading/storyBody/companyName/contactAddress into En fields", () => {
    const normalized = normalizeAboutUsContent(
      {
        storyHeading: "Legacy Heading",
        storyBody: "Legacy body",
        companyName: "Legacy Co",
        contactAddress: "Legacy Addr",
        termsSlug: "terms",
        termsUpdatedAt: null,
        privacySlug: "privacy",
        privacyUpdatedAt: null,
        appVersion: "v1",
      },
      DEFAULT_ABOUT_US_CONTENT,
    )
    expect(normalized.storyHeadingEn).toBe("Legacy Heading")
    expect(normalized.storyBodyEn).toBe("Legacy body")
    expect(normalized.companyNameEn).toBe("Legacy Co")
    expect(normalized.contactAddressEn).toBe("Legacy Addr")
    expect(normalized.sourceLanguage).toBe("English")
  })
})

describe("pickAboutUsLocalized", () => {
  it("falls back to English when the requested locale is empty", () => {
    const picked = pickAboutUsLocalized(EN_CONTENT, "Thai")
    expect(picked.storyHeading).toBe("Our Story")
    expect(picked.companyName).toBe("GemX Ltd.")
  })

  it("returns Myanmar fields when present", () => {
    const picked = pickAboutUsLocalized(
      { ...EN_CONTENT, storyHeadingMy: "MY heading", companyNameMy: "MY co" },
      "Myanmar",
    )
    expect(picked.storyHeading).toBe("MY heading")
    expect(picked.companyName).toBe("MY co")
  })
})

describe("localizeAboutUsIfEnglish", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns content unchanged when translateFromEnglish is false", async () => {
    const result = await localizeAboutUsIfEnglish(EN_CONTENT, false)
    expect(result).toEqual(EN_CONTENT)
    expect(detectNewsLanguage).not.toHaveBeenCalled()
  })

  it("translates EN fields into MY/TH/KO when English is detected", async () => {
    vi.mocked(detectNewsLanguage).mockResolvedValue("English")
    vi.mocked(isGoogleTranslateConfigured).mockReturnValue(true)
    vi.mocked(translateTexts)
      .mockResolvedValueOnce(["H-MY", "B-MY", "C-MY", "A-MY"])
      .mockResolvedValueOnce(["H-TH", "B-TH", "C-TH", "A-TH"])
      .mockResolvedValueOnce(["H-KO", "B-KO", "C-KO", "A-KO"])

    const result = await localizeAboutUsIfEnglish(EN_CONTENT, true)

    expect(result.storyHeadingMy).toBe("H-MY")
    expect(result.storyBodyTh).toBe("B-TH")
    expect(result.companyNameKo).toBe("C-KO")
    expect(result.contactAddressMy).toBe("A-MY")
    expect(translateTexts).toHaveBeenCalledTimes(3)
  })

  it("skips translation when detected language is not English", async () => {
    vi.mocked(detectNewsLanguage).mockResolvedValue("Myanmar")
    const result = await localizeAboutUsIfEnglish(EN_CONTENT, true)
    expect(result.sourceLanguage).toBe("Myanmar")
    expect(translateTexts).not.toHaveBeenCalled()
  })

  it("throws when English translate is requested but API key is missing", async () => {
    vi.mocked(detectNewsLanguage).mockResolvedValue("English")
    vi.mocked(isGoogleTranslateConfigured).mockReturnValue(false)
    await expect(localizeAboutUsIfEnglish(EN_CONTENT, true)).rejects.toThrow(
      /GOOGLE_TRANSLATE_API_KEY/,
    )
  })
})

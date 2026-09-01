import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/features/news/services/google-translate", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/news/services/google-translate")
  >("@/features/news/services/google-translate")
  return {
    ...actual,
    isGoogleTranslateConfigured: vi.fn(),
    detectNewsLanguage: vi.fn(),
    translateText: vi.fn(),
  }
})

import {
  isGoogleTranslateConfigured,
  detectNewsLanguage,
  translateText,
} from "@/features/news/services/google-translate"
import {
  buildLocalizedProductDescription,
  buildLocalizedProductTitle,
  pickLocalizedDescription,
  pickLocalizedTitle,
  localizedDescriptionFieldsForLanguage,
  localizedTitleFieldsForLanguage,
} from "@/features/products/services/localize-description"

describe("buildLocalizedProductTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("throws when title is blank", async () => {
    await expect(buildLocalizedProductTitle("   ")).rejects.toThrow(/title is required/i)
    expect(isGoogleTranslateConfigured).not.toHaveBeenCalled()
  })

  it("throws when Google Translate is not configured", async () => {
    vi.mocked(isGoogleTranslateConfigured).mockReturnValue(false)
    await expect(buildLocalizedProductTitle("Natural ruby")).rejects.toThrow(
      /GOOGLE_TRANSLATE_API_KEY/,
    )
  })

  it("detects English and translates into Myanmar, Thai, and Korean", async () => {
    // When source is English, fill the other three locales via translateText.
    vi.mocked(isGoogleTranslateConfigured).mockReturnValue(true)
    vi.mocked(detectNewsLanguage).mockResolvedValue("English")
    vi.mocked(translateText).mockImplementation(async (_text, _from, to) => {
      if (to === "Myanmar") return "မြန်မာ"
      if (to === "Thai") return "ไทย"
      if (to === "Korean") return "한국어"
      return _text
    })

    const result = await buildLocalizedProductTitle("Natural ruby")

    expect(detectNewsLanguage).toHaveBeenCalledWith("Natural ruby")
    expect(translateText).toHaveBeenCalledTimes(3)
    expect(result).toEqual({
      sourceLanguage: "English",
      title: "Natural ruby",
      titleEn: "Natural ruby",
      titleMy: "မြန်မာ",
      titleTh: "ไทย",
      titleKo: "한국어",
    })
  })
})

describe("buildLocalizedProductDescription", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("returns empty localized fields without calling Google when description is blank", async () => {
    // Empty description must not require GOOGLE_TRANSLATE_API_KEY.
    const result = await buildLocalizedProductDescription("   ")
    expect(result).toEqual({
      sourceLanguage: "English",
      description: "",
      descriptionEn: "",
      descriptionMy: "",
      descriptionTh: "",
      descriptionKo: "",
    })
    expect(isGoogleTranslateConfigured).not.toHaveBeenCalled()
    expect(detectNewsLanguage).not.toHaveBeenCalled()
  })

  it("throws when Google Translate is not configured for a non-empty description", async () => {
    vi.mocked(isGoogleTranslateConfigured).mockReturnValue(false)
    await expect(
      buildLocalizedProductDescription("Natural ruby from Mogok"),
    ).rejects.toThrow(/GOOGLE_TRANSLATE_API_KEY/)
  })

  it("detects English and translates into Myanmar, Thai, and Korean", async () => {
    // When source is English, fill the other three locales via translateText.
    vi.mocked(isGoogleTranslateConfigured).mockReturnValue(true)
    vi.mocked(detectNewsLanguage).mockResolvedValue("English")
    vi.mocked(translateText).mockImplementation(async (_text, _from, to) => {
      if (to === "Myanmar") return "မြန်မာ"
      if (to === "Thai") return "ไทย"
      if (to === "Korean") return "한국어"
      return _text
    })

    const result = await buildLocalizedProductDescription(
      "Natural ruby from Mogok",
    )

    expect(detectNewsLanguage).toHaveBeenCalledWith("Natural ruby from Mogok")
    expect(translateText).toHaveBeenCalledTimes(3)
    expect(result).toEqual({
      sourceLanguage: "English",
      description: "Natural ruby from Mogok",
      descriptionEn: "Natural ruby from Mogok",
      descriptionMy: "မြန်မာ",
      descriptionTh: "ไทย",
      descriptionKo: "한국어",
    })
  })

  it("detects Myanmar and translates into English, Thai, and Korean", async () => {
    // Any of the four supported languages can be the source.
    vi.mocked(isGoogleTranslateConfigured).mockReturnValue(true)
    vi.mocked(detectNewsLanguage).mockResolvedValue("Myanmar")
    vi.mocked(translateText).mockImplementation(async (_text, _from, to) => `via-${to}`)

    const result = await buildLocalizedProductDescription("ပတ္တမြား")

    expect(result.sourceLanguage).toBe("Myanmar")
    expect(result.descriptionMy).toBe("ပတ္တမြား")
    expect(result.descriptionEn).toBe("via-English")
    expect(result.descriptionTh).toBe("via-Thai")
    expect(result.descriptionKo).toBe("via-Korean")
  })
})

describe("pickLocalizedTitle", () => {
  const row = {
    title: "fallback",
    titleEn: "English title",
    titleMy: "Myanmar title",
    titleTh: "Thai title",
    titleKo: "Korean title",
  }

  it("returns canonical title when lang is omitted", () => {
    expect(pickLocalizedTitle(row)).toBe("fallback")
  })

  it("returns the matching locale column when present", () => {
    expect(pickLocalizedTitle(row, "Thai")).toBe("Thai title")
  })
})

describe("pickLocalizedDescription", () => {
  const row = {
    description: "fallback",
    descriptionEn: "English text",
    descriptionMy: "Myanmar text",
    descriptionTh: "Thai text",
    descriptionKo: "Korean text",
  }

  it("returns canonical description when lang is omitted", () => {
    expect(pickLocalizedDescription(row)).toBe("fallback")
  })

  it("returns the matching locale column when present", () => {
    expect(pickLocalizedDescription(row, "Thai")).toBe("Thai text")
  })

  it("falls back to canonical description when locale column is empty", () => {
    expect(
      pickLocalizedDescription(
        { ...row, descriptionKo: "   " },
        "Korean",
      ),
    ).toBe("fallback")
  })
})

describe("localizedTitleFieldsForLanguage", () => {
  it("updates only the selected locale column when editing a non-source language", () => {
    const fields = localizedTitleFieldsForLanguage("Thai", "ทับทิม", "English")
    expect(fields).toEqual({ titleTh: "ทับทิม" })
    expect(fields).not.toHaveProperty("title")
  })

  it("also updates canonical title when editing the source language", () => {
    const fields = localizedTitleFieldsForLanguage("English", "Natural ruby", "English")
    expect(fields).toEqual({
      titleEn: "Natural ruby",
      title: "Natural ruby",
    })
  })
})

describe("localizedDescriptionFieldsForLanguage", () => {
  it("updates only the selected locale column when editing a non-source language", () => {
    // Edit must not re-translate other locales.
    const fields = localizedDescriptionFieldsForLanguage(
      "Thai",
      "ทับทิม",
      "English",
    )
    expect(fields).toEqual({ descriptionTh: "ทับทิม" })
    expect(fields).not.toHaveProperty("description")
  })

  it("also updates canonical description when editing the source language", () => {
    const fields = localizedDescriptionFieldsForLanguage(
      "English",
      "Natural ruby",
      "English",
    )
    expect(fields).toEqual({
      descriptionEn: "Natural ruby",
      description: "Natural ruby",
    })
  })
})

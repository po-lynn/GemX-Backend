import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  extractBlockNotePlainText,
  localizeMultilangBlockNoteIfEnglish,
} from "@/features/app-content/lib/localize-terms"
import {
  detectNewsLanguage,
  isGoogleTranslateConfigured,
  translateBlockNoteContent,
} from "@/features/content/services/google-translate"

vi.mock("@/features/content/services/google-translate", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/content/services/google-translate")
  >("@/features/content/services/google-translate")
  return {
    ...actual,
    detectNewsLanguage: vi.fn(),
    isGoogleTranslateConfigured: vi.fn(),
    translateBlockNoteContent: vi.fn(),
  }
})

const EN_JSON =
  '[{"type":"paragraph","content":[{"type":"text","text":"Welcome to GemX"}]}]'

describe("extractBlockNotePlainText", () => {
  // Ensures language detection can read BlockNote text nodes.
  it("joins text fields from BlockNote JSON", () => {
    expect(extractBlockNotePlainText(EN_JSON)).toBe("Welcome to GemX")
  })

  it("returns empty string for invalid JSON", () => {
    expect(extractBlockNotePlainText("not-json")).toBe("")
  })
})

describe("localizeMultilangBlockNoteIfEnglish", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns content unchanged when translateFromEnglish is false", async () => {
    const input = {
      contentEn: EN_JSON,
      contentMy: "[]",
      contentTh: "[]",
      contentKo: "[]",
      sourceLanguage: "English" as const,
    }
    const result = await localizeMultilangBlockNoteIfEnglish(input, false)
    expect(result).toEqual(input)
    expect(detectNewsLanguage).not.toHaveBeenCalled()
  })

  it("translates EN body into MY/TH/KO when English is detected", async () => {
    vi.mocked(detectNewsLanguage).mockResolvedValue("English")
    vi.mocked(isGoogleTranslateConfigured).mockReturnValue(true)
    vi.mocked(translateBlockNoteContent)
      .mockResolvedValueOnce('[{"type":"paragraph","content":[{"type":"text","text":"MY"}]}]')
      .mockResolvedValueOnce('[{"type":"paragraph","content":[{"type":"text","text":"TH"}]}]')
      .mockResolvedValueOnce('[{"type":"paragraph","content":[{"type":"text","text":"KO"}]}]')

    const result = await localizeMultilangBlockNoteIfEnglish(
      {
        contentEn: EN_JSON,
        contentMy: "[]",
        contentTh: "[]",
        contentKo: "[]",
        sourceLanguage: "English",
      },
      true,
      "Buying Guide",
    )

    expect(result.contentMy).toContain("MY")
    expect(result.contentTh).toContain("TH")
    expect(result.contentKo).toContain("KO")
    expect(translateBlockNoteContent).toHaveBeenCalledTimes(3)
  })

  it("skips translation when detected language is not English", async () => {
    vi.mocked(detectNewsLanguage).mockResolvedValue("Myanmar")
    const input = {
      contentEn: EN_JSON,
      contentMy: "[]",
      contentTh: "[]",
      contentKo: "[]",
      sourceLanguage: "English" as const,
    }
    const result = await localizeMultilangBlockNoteIfEnglish(input, true)
    expect(result.sourceLanguage).toBe("Myanmar")
    expect(translateBlockNoteContent).not.toHaveBeenCalled()
  })

  it("throws when English translate is requested but API key is missing", async () => {
    vi.mocked(detectNewsLanguage).mockResolvedValue("English")
    vi.mocked(isGoogleTranslateConfigured).mockReturnValue(false)
    await expect(
      localizeMultilangBlockNoteIfEnglish(
        {
          contentEn: EN_JSON,
          contentMy: "[]",
          contentTh: "[]",
          contentKo: "[]",
          sourceLanguage: "English",
        },
        true,
        "Selling Guide",
      ),
    ).rejects.toThrow(/GOOGLE_TRANSLATE_API_KEY/)
  })
})

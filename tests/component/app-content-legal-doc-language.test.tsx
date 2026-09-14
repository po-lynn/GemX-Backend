// Regression test for the build-breaking duplicate `legalEditLanguage` declaration in
// AppContentClient.tsx. The fix keeps ONE definition: a per-document edit-language state
// (terms/buying/selling/privacy each get their own NewsLanguage) with `legalEditLanguage`
// derived from whichever doc is currently selected. This test locks in the resulting
// behavior — each legal document must remember its own edit language independently when
// switching between documents, rather than sharing one language or resetting on switch.
import { describe, it, expect, vi } from "vitest"
import { act, render, screen, fireEvent } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/app-content",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/features/app-content/actions/app-content", () => ({
  saveAppContentAction: vi.fn(),
}))

// FollowUsTab (statically imported by AppContentClient alongside the Legal tab)
// pulls this in, which chains into lib/auth.ts -> drizzle/db.ts -> server env access.
vi.mock("@/features/app-content/actions/app-content-icon", () => ({
  uploadAppContentIconAction: vi.fn(),
}))

// Stub out the BlockNote editor itself (rather than its @blocknote/* internals) —
// this test only cares about AppContentClient's language-per-document state, not
// the editor. Avoids pulling next/dynamic through the real useCreateBlockNote/
// authClient.useSession machinery, which introduces unrelated async scheduling.
vi.mock("@/features/content/components/BlockNoteEditor", () => ({
  BlockNoteEditor: () => <div data-testid="editor" />,
}))

import { AppContentClient } from "@/features/app-content/components/AppContentClient"
import type { MultilangBlockNoteContent } from "@/features/app-content/schemas/app-content"

function blankDoc(): MultilangBlockNoteContent {
  return { contentEn: "[]", contentMy: "[]", contentTh: "[]", contentKo: "[]", sourceLanguage: "English" }
}

function baseProps() {
  return {
    initialTab: "legal" as const,
    initialLegalDoc: "terms" as const,
    aboutUs: {
      storyHeadingEn: "H", storyHeadingMy: "", storyHeadingTh: "", storyHeadingKo: "",
      storyBodyEn: "", storyBodyMy: "", storyBodyTh: "", storyBodyKo: "",
      companyNameEn: "", companyNameMy: "", companyNameTh: "", companyNameKo: "",
      contactAddressEn: "", contactAddressMy: "", contactAddressTh: "", contactAddressKo: "",
      sourceLanguage: "English" as const,
      termsSlug: "", termsUpdatedAt: null, privacySlug: "", privacyUpdatedAt: null, appVersion: "",
    },
    followUs: { platforms: [] },
    helpSupport: {
      faqs: [], supportEmail: "", supportPhone: "", liveChatTelegram: "",
      weekdayHours: "", saturdayHours: "", sundayHours: "", timezone: "",
      reportFormEnabled: false, reportCategories: [], allowScreenshotAttachments: false,
    },
    termsConditions: blankDoc(),
    buyingGuide: blankDoc(),
    sellingGuide: blankDoc(),
    privacyPolicy: blankDoc(),
    lastEditedAt: null,
    lastEditedBy: null,
    currentUserName: "Admin",
  }
}

async function languageSelect() {
  return (await screen.findByLabelText("Language")) as HTMLSelectElement
}

// Drains React's scheduler (which uses setImmediate under jsdom) so no scheduled
// work leaks past this test into a torn-down environment.
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setImmediate(resolve))
  })
}

describe("AppContentClient — Legal & Guides per-document edit language", () => {
  it("keeps each legal document's edit language independent across doc switches", async () => {
    render(<AppContentClient {...baseProps()} />)

    // Starts on Terms & Conditions, default language English.
    let langSelect = await languageSelect()
    expect(langSelect.value).toBe("English")

    // Switch Terms' language to Myanmar.
    fireEvent.change(langSelect, { target: { value: "Myanmar" } })
    langSelect = await languageSelect()
    expect(langSelect.value).toBe("Myanmar")

    // Move to Buying Guide — it has its own state and must still default to English.
    const docSelect = screen.getByLabelText("Document") as HTMLSelectElement
    fireEvent.change(docSelect, { target: { value: "buying" } })
    langSelect = await languageSelect()
    expect(langSelect.value).toBe("English")

    // Switch back to Terms — Myanmar must have been preserved, not reset.
    fireEvent.change(docSelect, { target: { value: "terms" } })
    langSelect = await languageSelect()
    expect(langSelect.value).toBe("Myanmar")

    await flush()
  })
})

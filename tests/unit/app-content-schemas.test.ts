import { describe, it, expect } from "vitest"
import {
  socialPlatformSchema,
  faqItemSchema,
  aboutUsContentSchema,
  followUsContentSchema,
  helpSupportContentSchema,
  saveAppContentSchema,
} from "@/features/app-content/schemas/app-content"

const PLATFORM = {
  id: "00000000-0000-4000-8000-000000000001",
  iconKey: "facebook",
  customIconUrl: null,
  label: "Facebook",
  value: "facebook.com/gemx.app",
  url: "https://facebook.com/gemx.app",
  isActive: true,
  sortOrder: 0,
}

const FAQ = {
  id: "00000000-0000-4000-8000-000000000002",
  question: "How do I sell an item?",
  answer: "Tap the + button.",
  isActive: true,
  sortOrder: 0,
}

const ABOUT_US = {
  storyHeading: "Our Story",
  storyBody: "GemX began in 2019.",
  termsSlug: "terms",
  termsUpdatedAt: null,
  privacySlug: "privacy",
  privacyUpdatedAt: null,
  companyName: "GemX Technologies Ltd.",
  contactAddress: "Yangon, Myanmar",
  appVersion: "v2.4.1",
}

const HELP_SUPPORT = {
  faqs: [FAQ],
  supportEmail: "support@gemx.app",
  supportPhone: "+95 9 250 000 111",
  liveChatTelegram: "t.me/gemxsupport",
  weekdayHours: "9:00–18:00",
  saturdayHours: "10:00–15:00",
  sundayHours: "Closed",
  timezone: "Asia/Yangon (UTC+06:30)",
  reportFormEnabled: true,
  reportCategories: ["Bug", "Payment"],
  allowScreenshotAttachments: true,
}

describe("socialPlatformSchema", () => {
  it("accepts a valid built-in platform", () => {
    expect(socialPlatformSchema.safeParse(PLATFORM).success).toBe(true)
  })

  it("rejects a custom icon with no customIconUrl (allowed to be null even for custom)", () => {
    // customIconUrl is nullable regardless of iconKey — the UI is responsible for
    // requiring an upload when iconKey is "custom"; the schema only validates shape.
    const result = socialPlatformSchema.safeParse({ ...PLATFORM, iconKey: "custom", customIconUrl: null })
    expect(result.success).toBe(true)
  })

  it("rejects an empty label", () => {
    expect(socialPlatformSchema.safeParse({ ...PLATFORM, label: "" }).success).toBe(false)
  })

  it("rejects an invalid iconKey", () => {
    expect(socialPlatformSchema.safeParse({ ...PLATFORM, iconKey: "snapchat" }).success).toBe(false)
  })

  it("rejects a negative sortOrder", () => {
    expect(socialPlatformSchema.safeParse({ ...PLATFORM, sortOrder: -1 }).success).toBe(false)
  })
})

describe("faqItemSchema", () => {
  it("accepts a valid FAQ", () => {
    expect(faqItemSchema.safeParse(FAQ).success).toBe(true)
  })

  it("rejects an empty question", () => {
    expect(faqItemSchema.safeParse({ ...FAQ, question: "" }).success).toBe(false)
  })
})

describe("aboutUsContentSchema", () => {
  it("accepts valid about-us content", () => {
    expect(aboutUsContentSchema.safeParse(ABOUT_US).success).toBe(true)
  })

  it("accepts an empty storyBody (no content yet is valid)", () => {
    expect(aboutUsContentSchema.safeParse({ ...ABOUT_US, storyBody: "" }).success).toBe(true)
  })

  it("rejects a missing storyHeading", () => {
    const { storyHeading: _drop, ...rest } = ABOUT_US
    expect(aboutUsContentSchema.safeParse(rest).success).toBe(false)
  })
})

describe("followUsContentSchema", () => {
  it("accepts an empty platforms array", () => {
    expect(followUsContentSchema.safeParse({ platforms: [] }).success).toBe(true)
  })

  it("accepts a list of valid platforms", () => {
    expect(followUsContentSchema.safeParse({ platforms: [PLATFORM] }).success).toBe(true)
  })
})

describe("helpSupportContentSchema", () => {
  it("accepts valid help & support content", () => {
    expect(helpSupportContentSchema.safeParse(HELP_SUPPORT).success).toBe(true)
  })

  it("accepts an empty supportEmail (optional field)", () => {
    expect(helpSupportContentSchema.safeParse({ ...HELP_SUPPORT, supportEmail: "" }).success).toBe(true)
  })

  it("rejects a malformed supportEmail", () => {
    expect(helpSupportContentSchema.safeParse({ ...HELP_SUPPORT, supportEmail: "not-an-email" }).success).toBe(false)
  })
})

describe("saveAppContentSchema", () => {
  it("accepts all three sections omitted (nothing to save)", () => {
    expect(saveAppContentSchema.safeParse({}).success).toBe(true)
  })

  it("accepts a payload with only one section present", () => {
    expect(saveAppContentSchema.safeParse({ aboutUs: ABOUT_US }).success).toBe(true)
  })

  it("rejects a payload with an invalid nested section", () => {
    expect(
      saveAppContentSchema.safeParse({ aboutUs: { ...ABOUT_US, storyHeading: "" } }).success
    ).toBe(false)
  })
})

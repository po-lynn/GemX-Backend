import { z } from "zod"

export const socialIconKeySchema = z.enum([
  "facebook",
  "instagram",
  "telegram",
  "tiktok",
  "viber",
  "custom",
])

export const socialPlatformSchema = z.object({
  id: z.string().uuid(),
  iconKey: socialIconKeySchema,
  customIconUrl: z.string().url().nullable(),
  label: z.string().min(1, "Label is required").max(60),
  value: z.string().min(1, "Value is required").max(200),
  url: z.string().min(1, "URL is required").max(500),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0),
})

export const faqItemSchema = z.object({
  id: z.string().uuid(),
  question: z.string().min(1, "Question is required").max(300),
  answer: z.string().min(1, "Answer is required").max(2000),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0),
})

/**
 * About Us multilang plain-text fields (EN/MY/TH/KO).
 * Save while Language = English auto-translates the four story/company fields.
 * Non-translated: termsSlug, privacySlug, appVersion, *UpdatedAt.
 */
export const aboutUsContentSchema = z.object({
  storyHeadingEn: z.string().min(1, "Heading is required").max(100),
  storyHeadingMy: z.string().max(100),
  storyHeadingTh: z.string().max(100),
  storyHeadingKo: z.string().max(100),
  storyBodyEn: z.string().max(5000),
  storyBodyMy: z.string().max(5000),
  storyBodyTh: z.string().max(5000),
  storyBodyKo: z.string().max(5000),
  companyNameEn: z.string().max(200),
  companyNameMy: z.string().max(200),
  companyNameTh: z.string().max(200),
  companyNameKo: z.string().max(200),
  contactAddressEn: z.string().max(500),
  contactAddressMy: z.string().max(500),
  contactAddressTh: z.string().max(500),
  contactAddressKo: z.string().max(500),
  sourceLanguage: z.enum(["English", "Myanmar", "Thai", "Korean"]).default("English"),
  termsSlug: z.string().max(100),
  termsUpdatedAt: z.string().nullable(),
  privacySlug: z.string().max(100),
  privacyUpdatedAt: z.string().nullable(),
  appVersion: z.string().max(30),
})

export const followUsContentSchema = z.object({
  platforms: z.array(socialPlatformSchema).max(50),
})

export const helpSupportContentSchema = z.object({
  faqs: z.array(faqItemSchema).max(100),
  supportEmail: z.string().email("Invalid email").or(z.literal("")),
  supportPhone: z.string().max(40),
  liveChatTelegram: z.string().max(100),
  weekdayHours: z.string().max(50),
  saturdayHours: z.string().max(50),
  sundayHours: z.string().max(50),
  timezone: z.string().max(60),
  reportFormEnabled: z.boolean(),
  reportCategories: z.array(z.string().min(1).max(40)).max(20),
  allowScreenshotAttachments: z.boolean(),
})

/**
 * Shared BlockNote JSON strings per locale.
 * Used by Legal & Guides: Terms, Buying Guide, Selling Guide, Privacy Policy.
 */
export const multilangBlockNoteContentSchema = z.object({
  contentEn: z.string(),
  contentMy: z.string(),
  contentTh: z.string(),
  contentKo: z.string(),
  sourceLanguage: z.enum(["English", "Myanmar", "Thai", "Korean"]).default("English"),
})

/** @deprecated Prefer multilangBlockNoteContentSchema — same shape. */
export const termsConditionsContentSchema = multilangBlockNoteContentSchema

export const saveAppContentSchema = z.object({
  aboutUs: aboutUsContentSchema.optional(),
  followUs: followUsContentSchema.optional(),
  helpSupport: helpSupportContentSchema.optional(),
  termsConditions: multilangBlockNoteContentSchema.optional(),
  buyingGuide: multilangBlockNoteContentSchema.optional(),
  sellingGuide: multilangBlockNoteContentSchema.optional(),
  privacyPolicy: multilangBlockNoteContentSchema.optional(),
  /** When true and English body is detected, fill MY/TH/KO from contentEn via Google Translate. */
  translateFromEnglish: z.boolean().optional(),
  /** @deprecated Use translateFromEnglish */
  translateTermsFromEnglish: z.boolean().optional(),
})

export type SocialPlatform = z.infer<typeof socialPlatformSchema>
export type FaqItem = z.infer<typeof faqItemSchema>
export type AboutUsContent = z.infer<typeof aboutUsContentSchema>
export type FollowUsContent = z.infer<typeof followUsContentSchema>
export type HelpSupportContent = z.infer<typeof helpSupportContentSchema>
export type MultilangBlockNoteContent = z.infer<typeof multilangBlockNoteContentSchema>
export type TermsConditionsContent = MultilangBlockNoteContent
export type BuyingGuideContent = MultilangBlockNoteContent
export type SellingGuideContent = MultilangBlockNoteContent
export type PrivacyPolicyContent = MultilangBlockNoteContent
export type SaveAppContentInput = z.infer<typeof saveAppContentSchema>

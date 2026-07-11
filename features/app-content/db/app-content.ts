import { db } from "@/drizzle/db"
import { appContentSection } from "@/drizzle/schema/app-content-schema"
import { eq } from "drizzle-orm"
import type {
  AboutUsContent,
  FollowUsContent,
  HelpSupportContent,
} from "@/features/app-content/schemas/app-content"

export type AppContentSectionName = "about_us" | "follow_us" | "help_support"

export type AppContentSectionRow<T> = {
  draftContent: T
  publishedContent: T | null
  hasUnpublishedChanges: boolean
  updatedAt: Date | null
  updatedByName: string | null
  publishedAt: Date | null
  publishedByName: string | null
}

export type AppContentSections = {
  aboutUs: AppContentSectionRow<AboutUsContent>
  followUs: AppContentSectionRow<FollowUsContent>
  helpSupport: AppContentSectionRow<HelpSupportContent>
}

export const DEFAULT_ABOUT_US_CONTENT: AboutUsContent = {
  storyHeading: "Our Story",
  storyBody: "",
  termsSlug: "",
  termsUpdatedAt: null,
  privacySlug: "",
  privacyUpdatedAt: null,
  companyName: "",
  contactAddress: "",
  appVersion: "",
}

export const DEFAULT_FOLLOW_US_CONTENT: FollowUsContent = { platforms: [] }

export const DEFAULT_HELP_SUPPORT_CONTENT: HelpSupportContent = {
  faqs: [],
  supportEmail: "",
  supportPhone: "",
  liveChatTelegram: "",
  weekdayHours: "",
  saturdayHours: "",
  sundayHours: "",
  timezone: "Asia/Yangon (UTC+06:30)",
  reportFormEnabled: false,
  reportCategories: [],
  allowScreenshotAttachments: false,
}

type SectionContentMap = {
  about_us: AboutUsContent
  follow_us: FollowUsContent
  help_support: HelpSupportContent
}

const SECTION_DEFAULTS: SectionContentMap = {
  about_us: DEFAULT_ABOUT_US_CONTENT,
  follow_us: DEFAULT_FOLLOW_US_CONTENT,
  help_support: DEFAULT_HELP_SUPPORT_CONTENT,
}

type RawSectionRow = {
  section: AppContentSectionName
  draftContent: unknown
  publishedContent: unknown
  hasUnpublishedChanges: boolean
  updatedAt: Date | null
  updatedByName: string | null
  publishedAt: Date | null
  publishedByName: string | null
}

function toRow<K extends AppContentSectionName>(
  section: K,
  raw: RawSectionRow | undefined
): AppContentSectionRow<SectionContentMap[K]> {
  if (!raw) {
    return {
      draftContent: SECTION_DEFAULTS[section],
      publishedContent: null,
      hasUnpublishedChanges: false,
      updatedAt: null,
      updatedByName: null,
      publishedAt: null,
      publishedByName: null,
    }
  }
  return {
    draftContent: raw.draftContent as SectionContentMap[K],
    publishedContent: (raw.publishedContent as SectionContentMap[K] | null) ?? null,
    hasUnpublishedChanges: raw.hasUnpublishedChanges,
    updatedAt: raw.updatedAt,
    updatedByName: raw.updatedByName,
    publishedAt: raw.publishedAt,
    publishedByName: raw.publishedByName,
  }
}

export async function getAppContentSections(): Promise<AppContentSections> {
  const rows = (await db.select().from(appContentSection)) as RawSectionRow[]
  const bySection = new Map(rows.map((r) => [r.section, r]))
  return {
    aboutUs: toRow("about_us", bySection.get("about_us")),
    followUs: toRow("follow_us", bySection.get("follow_us")),
    helpSupport: toRow("help_support", bySection.get("help_support")),
  }
}

export async function saveAppContentDraft(input: {
  aboutUs?: AboutUsContent
  followUs?: FollowUsContent
  helpSupport?: HelpSupportContent
  updatedByName: string
}): Promise<void> {
  const entries: Array<[AppContentSectionName, unknown]> = []
  if (input.aboutUs) entries.push(["about_us", input.aboutUs])
  if (input.followUs) entries.push(["follow_us", input.followUs])
  if (input.helpSupport) entries.push(["help_support", input.helpSupport])
  if (entries.length === 0) return

  await db.transaction(async (tx) => {
    for (const [section, content] of entries) {
      await tx
        .insert(appContentSection)
        .values({
          section,
          draftContent: content,
          hasUnpublishedChanges: true,
          updatedByName: input.updatedByName,
        })
        .onConflictDoUpdate({
          target: appContentSection.section,
          set: {
            draftContent: content,
            hasUnpublishedChanges: true,
            updatedByName: input.updatedByName,
            updatedAt: new Date(),
          },
        })
    }
  })
}

export async function publishAppContentSections(
  publishedByName: string
): Promise<{ published: AppContentSectionName[] }> {
  return db.transaction(async (tx) => {
    const rows = (await tx
      .select()
      .from(appContentSection)
      .where(eq(appContentSection.hasUnpublishedChanges, true))) as Array<
      RawSectionRow & { id: string }
    >
    const published: AppContentSectionName[] = []
    for (const row of rows) {
      await tx
        .update(appContentSection)
        .set({
          publishedContent: row.draftContent,
          hasUnpublishedChanges: false,
          publishedAt: new Date(),
          publishedByName,
        })
        .where(eq(appContentSection.id, row.id))
      published.push(row.section)
    }
    return { published }
  })
}

async function getPublishedContent<K extends AppContentSectionName>(
  section: K
): Promise<SectionContentMap[K]> {
  const [row] = await db
    .select({ publishedContent: appContentSection.publishedContent })
    .from(appContentSection)
    .where(eq(appContentSection.section, section))
    .limit(1)
  return (row?.publishedContent as SectionContentMap[K] | undefined) ?? SECTION_DEFAULTS[section]
}

export function getPublishedAboutUs(): Promise<AboutUsContent> {
  return getPublishedContent("about_us")
}

export function getPublishedFollowUs(): Promise<FollowUsContent> {
  return getPublishedContent("follow_us")
}

export function getPublishedHelpSupport(): Promise<HelpSupportContent> {
  return getPublishedContent("help_support")
}

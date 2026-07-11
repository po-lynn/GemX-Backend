import { NextRequest, connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getCachedPublishedHelpSupport } from "@/features/app-content/db/cache/app-content"

/** Public read-only Help & Support content for the mobile app. No auth required. */
export async function GET(_request: NextRequest) {
  await connection()
  try {
    const content = await getCachedPublishedHelpSupport()
    const activeFaqs = content.faqs
      .filter((f) => f.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ question, answer }) => ({ question, answer }))

    return jsonCached({
      faqs: activeFaqs,
      contact: {
        email: content.supportEmail,
        phone: content.supportPhone,
        telegram: content.liveChatTelegram,
      },
      hours: {
        weekday: content.weekdayHours,
        saturday: content.saturdayHours,
        sunday: content.sundayHours,
        timezone: content.timezone,
      },
      reportForm: {
        enabled: content.reportFormEnabled,
        categories: content.reportCategories,
        allowScreenshots: content.allowScreenshotAttachments,
      },
    })
  } catch (e) {
    console.error("GET /api/mobile/help-support:", e)
    return jsonError("Failed to load help & support content", 500)
  }
}

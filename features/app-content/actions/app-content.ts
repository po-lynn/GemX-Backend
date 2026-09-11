"use server"

import { requireActionRole } from "@/lib/action-guard"
import { canManageAppContent } from "@/features/app-content/permissions/app-content"
import { saveAppContentSchema, type SaveAppContentInput } from "@/features/app-content/schemas/app-content"
import { saveAppContentDraft, publishAppContentSections } from "@/features/app-content/db/app-content"
import { revalidateAppContentCache } from "@/features/app-content/db/cache/app-content"
import { localizeMultilangBlockNoteIfEnglish } from "@/features/app-content/lib/localize-terms"
import { zodErrorMessage } from "@/lib/form-data"

export async function saveAppContentAction(input: SaveAppContentInput) {
  const parsed = saveAppContentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) }
  }
  if (
    !parsed.data.aboutUs &&
    !parsed.data.followUs &&
    !parsed.data.helpSupport &&
    !parsed.data.termsConditions &&
    !parsed.data.buyingGuide &&
    !parsed.data.sellingGuide
  ) {
    return { error: "Nothing to save" }
  }
  const session = await requireActionRole(canManageAppContent)
  if (!session) {
    return { error: "Unauthorized" }
  }
  try {
    const translateFromEnglish =
      parsed.data.translateFromEnglish === true ||
      parsed.data.translateTermsFromEnglish === true

    let termsConditions = parsed.data.termsConditions
    let buyingGuide = parsed.data.buyingGuide
    let sellingGuide = parsed.data.sellingGuide

    if (termsConditions) {
      termsConditions = await localizeMultilangBlockNoteIfEnglish(
        termsConditions,
        translateFromEnglish,
        "Terms & Conditions",
      )
    }
    if (buyingGuide) {
      buyingGuide = await localizeMultilangBlockNoteIfEnglish(
        buyingGuide,
        translateFromEnglish,
        "Buying Guide",
      )
    }
    if (sellingGuide) {
      sellingGuide = await localizeMultilangBlockNoteIfEnglish(
        sellingGuide,
        translateFromEnglish,
        "Selling Guide",
      )
    }

    await saveAppContentDraft({
      aboutUs: parsed.data.aboutUs,
      followUs: parsed.data.followUs,
      helpSupport: parsed.data.helpSupport,
      termsConditions,
      buyingGuide,
      sellingGuide,
      updatedByName: session.user.name ?? session.user.email ?? "Admin",
    })
    revalidateAppContentCache()
    return {
      success: true as const,
      termsConditions: termsConditions ?? undefined,
      buyingGuide: buyingGuide ?? undefined,
      sellingGuide: sellingGuide ?? undefined,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save app content"
    return { error: message }
  }
}

export async function publishAppContentAction() {
  const session = await requireActionRole(canManageAppContent)
  if (!session) {
    return { error: "Unauthorized" }
  }
  try {
    const { published } = await publishAppContentSections(
      session.user.name ?? session.user.email ?? "Admin"
    )
    if (published.length === 0) {
      return { error: "Nothing to publish" }
    }
    revalidateAppContentCache()
    return { success: true as const, published }
  } catch {
    return { error: "Failed to publish app content" }
  }
}

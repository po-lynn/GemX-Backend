"use server"

import { requireActionRole } from "@/lib/action-guard"
import { canManageAppContent } from "@/features/app-content/permissions/app-content"
import { saveAppContentSchema, type SaveAppContentInput } from "@/features/app-content/schemas/app-content"
import { saveAppContentDraft, publishAppContentSections } from "@/features/app-content/db/app-content"
import { revalidateAppContentCache } from "@/features/app-content/db/cache/app-content"
import { zodErrorMessage } from "@/lib/form-data"

export async function saveAppContentAction(input: SaveAppContentInput) {
  const parsed = saveAppContentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) }
  }
  if (!parsed.data.aboutUs && !parsed.data.followUs && !parsed.data.helpSupport) {
    return { error: "Nothing to save" }
  }
  const session = await requireActionRole(canManageAppContent)
  if (!session) {
    return { error: "Unauthorized" }
  }
  try {
    await saveAppContentDraft({
      aboutUs: parsed.data.aboutUs,
      followUs: parsed.data.followUs,
      helpSupport: parsed.data.helpSupport,
      updatedByName: session.user.name ?? session.user.email ?? "Admin",
    })
    return { success: true as const }
  } catch {
    return { error: "Failed to save app content" }
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

"use server"

import { revalidatePrecautionTagCache } from "@/features/precaution-tags/db/cache/precaution-tags"
import { canAdminManagePrecautionTags } from "@/features/precaution-tags/permissions/precaution-tags"
import {
  precautionTagCreateSchema,
  precautionTagDeleteSchema,
  precautionTagUpdateSchema,
} from "@/features/precaution-tags/schemas/precaution-tags"
import {
  createPrecautionTagInDb,
  deletePrecautionTagInDb,
  updatePrecautionTagInDb,
} from "@/features/precaution-tags/db/precaution-tags"
import { zodErrorMessage } from "@/lib/form-data"
import { requireActionRole } from "@/lib/action-guard"

function parseBool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on"
}

export async function createPrecautionTagAction(formData: FormData) {
  const parsed = precautionTagCreateSchema.safeParse({
    name: formData.get("name"),
    severity: formData.get("severity"),
    appliesTo: formData.get("appliesTo"),
    isActive: parseBool(formData, "isActive"),
  })
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) }
  }
  const session = await requireActionRole(canAdminManagePrecautionTags)
  if (!session) {
    return { error: "Unauthorized" }
  }
  const precautionTagId = await createPrecautionTagInDb(parsed.data)
  revalidatePrecautionTagCache()
  return { success: true, precautionTagId }
}

export async function updatePrecautionTagAction(formData: FormData) {
  const parsed = precautionTagUpdateSchema.safeParse({
    precautionTagId: formData.get("precautionTagId"),
    name: formData.get("name"),
    severity: formData.get("severity"),
    appliesTo: formData.get("appliesTo"),
    isActive: parseBool(formData, "isActive"),
  })
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) }
  }
  const session = await requireActionRole(canAdminManagePrecautionTags)
  if (!session) {
    return { error: "Unauthorized" }
  }
  const { precautionTagId, name, severity, appliesTo, isActive } = parsed.data
  await updatePrecautionTagInDb(precautionTagId, { name, severity, appliesTo, isActive })
  revalidatePrecautionTagCache(precautionTagId)
  return { success: true, precautionTagId }
}

export async function deletePrecautionTagAction(formData: FormData) {
  const parsed = precautionTagDeleteSchema.safeParse({
    precautionTagId: formData.get("precautionTagId"),
  })
  if (!parsed.success) return { error: "Invalid input" }
  const session = await requireActionRole(canAdminManagePrecautionTags)
  if (!session) {
    return { error: "Unauthorized" }
  }
  const deleted = await deletePrecautionTagInDb(parsed.data.precautionTagId)
  if (!deleted) return { error: "Tag not found" }
  revalidatePrecautionTagCache(parsed.data.precautionTagId)
  return { success: true }
}

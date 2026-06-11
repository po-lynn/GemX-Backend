"use server"

import { revalidateRatingTagCache } from "@/features/rating-tags/db/cache/rating-tags"
import { canAdminManageRatingTags } from "@/features/rating-tags/permissions/rating-tags"
import {
  ratingTagCreateSchema,
  ratingTagDeleteSchema,
  ratingTagUpdateSchema,
} from "@/features/rating-tags/schemas/rating-tags"
import {
  createRatingTagInDb,
  deleteRatingTagInDb,
  updateRatingTagInDb,
} from "@/features/rating-tags/db/rating-tags"
import { zodErrorMessage } from "@/lib/form-data"
import { requireActionRole } from "@/lib/action-guard"

function parseBool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on"
}

export async function createRatingTagAction(formData: FormData) {
  const parsed = ratingTagCreateSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    isActive: parseBool(formData, "isActive"),
  })
  if (!parsed.success) {
    return {
      error:
        zodErrorMessage(parsed.error),
    }
  }
  const session = await requireActionRole(canAdminManageRatingTags)
  if (!session) {
    return { error: "Unauthorized" }
  }
  const ratingTagId = await createRatingTagInDb(parsed.data)
  revalidateRatingTagCache()
  return { success: true, ratingTagId }
}

export async function updateRatingTagAction(formData: FormData) {
  const parsed = ratingTagUpdateSchema.safeParse({
    ratingTagId: formData.get("ratingTagId"),
    name: formData.get("name"),
    type: formData.get("type"),
    isActive: parseBool(formData, "isActive"),
  })
  if (!parsed.success) {
    return {
      error:
        zodErrorMessage(parsed.error),
    }
  }
  const session = await requireActionRole(canAdminManageRatingTags)
  if (!session) {
    return { error: "Unauthorized" }
  }
  const { ratingTagId, name, type, isActive } = parsed.data
  await updateRatingTagInDb(ratingTagId, { name, type, isActive })
  revalidateRatingTagCache(ratingTagId)
  return { success: true, ratingTagId }
}

export async function deleteRatingTagAction(formData: FormData) {
  const parsed = ratingTagDeleteSchema.safeParse({
    ratingTagId: formData.get("ratingTagId"),
  })
  if (!parsed.success) return { error: "Invalid input" }
  const session = await requireActionRole(canAdminManageRatingTags)
  if (!session) {
    return { error: "Unauthorized" }
  }
  const deleted = await deleteRatingTagInDb(parsed.data.ratingTagId)
  if (!deleted) return { error: "Tag not found" }
  revalidateRatingTagCache(parsed.data.ratingTagId)
  return { success: true }
}

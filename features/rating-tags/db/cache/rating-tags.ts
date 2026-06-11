import { cacheTag, updateTag } from "next/cache"
import { getGlobalTag, getIdTag } from "@/lib/dataCache"
import { getAllRatingTags, getRatingTagById } from "../rating-tags"
import type { RatingTagForEdit, RatingTagRow } from "../rating-tags"

function getRatingTagGlobalTag() {
  return getGlobalTag("ratingTag")
}

function getRatingTagIdTag(id: string) {
  return getIdTag("ratingTag", id)
}

export async function getCachedRatingTags(): Promise<RatingTagRow[]> {
  "use cache"
  cacheTag(getRatingTagGlobalTag())
  return getAllRatingTags()
}

export async function getCachedRatingTagById(
  id: string
): Promise<RatingTagForEdit | null> {
  "use cache"
  cacheTag(getRatingTagGlobalTag(), getRatingTagIdTag(id))
  return getRatingTagById(id)
}

export function revalidateRatingTagCache(id?: string) {
  updateTag(getRatingTagGlobalTag())
  if (id) updateTag(getRatingTagIdTag(id))
}

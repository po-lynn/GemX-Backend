import { cacheTag, updateTag } from "next/cache"
import { getGlobalTag, getIdTag } from "@/lib/dataCache"
import { getAllPrecautionTags, getPrecautionTagById, getPublicPrecautionTags } from "../precaution-tags"
import type { PrecautionTagForEdit, PrecautionTagPublic, PrecautionTagRow } from "../precaution-tags"

function getPrecautionTagGlobalTag() {
  return getGlobalTag("precautionTag")
}

function getPrecautionTagIdTag(id: string) {
  return getIdTag("precautionTag", id)
}

export async function getCachedPrecautionTags(): Promise<PrecautionTagRow[]> {
  "use cache"
  cacheTag(getPrecautionTagGlobalTag())
  return getAllPrecautionTags()
}

export async function getCachedPrecautionTagById(
  id: string
): Promise<PrecautionTagForEdit | null> {
  "use cache"
  cacheTag(getPrecautionTagGlobalTag(), getPrecautionTagIdTag(id))
  return getPrecautionTagById(id)
}

/** All active precaution tags with their appliesTo context — for buyer-facing surfaces. */
export async function getCachedPublicPrecautionTags(): Promise<PrecautionTagPublic[]> {
  "use cache"
  cacheTag(getPrecautionTagGlobalTag())
  return getPublicPrecautionTags()
}

export function revalidatePrecautionTagCache(id?: string) {
  updateTag(getPrecautionTagGlobalTag())
  if (id) updateTag(getPrecautionTagIdTag(id))
}

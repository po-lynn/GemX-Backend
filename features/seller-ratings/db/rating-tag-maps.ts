import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { ratingTag } from "@/drizzle/schema/rating-tag-schema"
import { ratingTagMap } from "@/drizzle/schema/rating-tag-map-schema"

/** Every id must exist on `rating_tags` and be active (mobile may only submit from GET /api/rating-tags). */
export async function assertActiveRatingTagIds(tagIds: string[]): Promise<boolean> {
  if (tagIds.length === 0) return true
  const rows = await db
    .select({ id: ratingTag.id })
    .from(ratingTag)
    .where(and(inArray(ratingTag.id, tagIds), eq(ratingTag.isActive, true)))
  return rows.length === tagIds.length
}

export async function getTagIdsByRatingIds(
  ratingIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (ratingIds.length === 0) return map
  const rows = await db
    .select({
      ratingId: ratingTagMap.ratingId,
      tagId: ratingTagMap.tagId,
    })
    .from(ratingTagMap)
    .where(inArray(ratingTagMap.ratingId, ratingIds))
  for (const row of rows) {
    const list = map.get(row.ratingId) ?? []
    list.push(row.tagId)
    map.set(row.ratingId, list)
  }
  return map
}

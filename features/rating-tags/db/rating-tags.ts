import { db } from "@/drizzle/db"
import { ratingTag } from "@/drizzle/schema/rating-tag-schema"
import { asc, eq } from "drizzle-orm"

export type RatingTagRow = {
  id: string
  name: string
  type: "positive" | "negative"
  isActive: boolean
}

export type RatingTagForEdit = RatingTagRow

/** Active tags only; for public/mobile pickers (hidden admin tags excluded). */
export type RatingTagPublic = {
  id: string
  name: string
  type: "positive" | "negative"
}

export async function getPublicRatingTags(): Promise<RatingTagPublic[]> {
  return db
    .select({
      id: ratingTag.id,
      name: ratingTag.name,
      type: ratingTag.type,
    })
    .from(ratingTag)
    .where(eq(ratingTag.isActive, true))
    .orderBy(asc(ratingTag.type), asc(ratingTag.name))
}

export async function getAllRatingTags(): Promise<RatingTagRow[]> {
  return db
    .select({
      id: ratingTag.id,
      name: ratingTag.name,
      type: ratingTag.type,
      isActive: ratingTag.isActive,
    })
    .from(ratingTag)
    .orderBy(asc(ratingTag.type), asc(ratingTag.name))
}

export async function getRatingTagById(id: string): Promise<RatingTagForEdit | null> {
  const row = await db
    .select({
      id: ratingTag.id,
      name: ratingTag.name,
      type: ratingTag.type,
      isActive: ratingTag.isActive,
    })
    .from(ratingTag)
    .where(eq(ratingTag.id, id))
    .limit(1)
  return row[0] ?? null
}

export async function createRatingTagInDb(input: {
  name: string
  type: "positive" | "negative"
  isActive: boolean
}): Promise<string> {
  const [inserted] = await db
    .insert(ratingTag)
    .values({
      name: input.name,
      type: input.type,
      isActive: input.isActive,
    })
    .returning({ id: ratingTag.id })
  return inserted!.id
}

export async function updateRatingTagInDb(
  id: string,
  input: { name?: string; type?: "positive" | "negative"; isActive?: boolean }
): Promise<boolean> {
  const updates = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined)
  ) as Partial<{
    name: string
    type: "positive" | "negative"
    isActive: boolean
  }>
  if (Object.keys(updates).length === 0) return true
  await db.update(ratingTag).set(updates).where(eq(ratingTag.id, id))
  return true
}

export async function deleteRatingTagInDb(id: string): Promise<boolean> {
  const deleted = await db
    .delete(ratingTag)
    .where(eq(ratingTag.id, id))
    .returning({ id: ratingTag.id })
  return deleted.length > 0
}

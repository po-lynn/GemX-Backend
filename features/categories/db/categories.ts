import { db } from "@/drizzle/db"
import { category } from "@/drizzle/schema/category-schema"
import { eq, asc } from "drizzle-orm"

export type CategoryRow = {
  id: string
  type: "loose_stone" | "jewellery"
  name: string
  shortCode: string | null
  slug: string
  sortOrder: number
}

export async function getCategoriesByType(
  type: "loose_stone" | "jewellery"
): Promise<CategoryRow[]> {
  const rows = await db
    .select({
      id: category.id,
      type: category.type,
      name: category.name,
      shortCode: category.shortCode,
      slug: category.slug,
      sortOrder: category.sortOrder,
    })
    .from(category)
    .where(eq(category.type, type))
    .orderBy(asc(category.sortOrder), asc(category.name))

  return rows
}

export async function getAllCategories(): Promise<CategoryRow[]> {
  const rows = await db
    .select({
      id: category.id,
      type: category.type,
      name: category.name,
      shortCode: category.shortCode,
      slug: category.slug,
      sortOrder: category.sortOrder,
    })
    .from(category)
    .orderBy(asc(category.type), asc(category.sortOrder), asc(category.name))

  return rows
}

export async function getCategoryById(id: string): Promise<CategoryRow | null> {
  const [row] = await db
    .select({
      id: category.id,
      type: category.type,
      name: category.name,
      shortCode: category.shortCode,
      slug: category.slug,
      sortOrder: category.sortOrder,
    })
    .from(category)
    .where(eq(category.id, id))

  return row ?? null
}

export type CreateCategoryInput = {
  type: "loose_stone" | "jewellery"
  name: string
  shortCode: string
  slug: string
  sortOrder?: number
}

export async function createCategoryInDb(input: CreateCategoryInput): Promise<string> {
  const [inserted] = await db
    .insert(category)
    .values({
      type: input.type,
      name: input.name,
      shortCode: input.shortCode.trim(),
      slug: input.slug,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning({ id: category.id })

  if (!inserted) throw new Error("Failed to create category")
  return inserted.id
}

export type UpdateCategoryInput = {
  type?: "loose_stone" | "jewellery"
  name?: string
  shortCode?: string | null
  slug?: string
  sortOrder?: number
}

export async function updateCategoryInDb(id: string, input: UpdateCategoryInput): Promise<void> {
  const updates: Partial<typeof category.$inferInsert> = {}
  if (input.type !== undefined) updates.type = input.type
  if (input.name !== undefined) updates.name = input.name
  if (input.shortCode !== undefined) updates.shortCode = input.shortCode?.trim() || null
  if (input.slug !== undefined) updates.slug = input.slug
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder
  if (Object.keys(updates).length === 0) return
  await db.update(category).set(updates).where(eq(category.id, id))
}

export async function deleteCategoryInDb(id: string): Promise<boolean> {
  const deleted = await db
    .delete(category)
    .where(eq(category.id, id))
    .returning({ id: category.id })
  return deleted.length > 0
}

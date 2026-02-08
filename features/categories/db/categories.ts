import { db } from "@/drizzle/db"
import {
  productCategory,
  categorySpecies,
  species,
} from "@/drizzle/schema/category-schema"
import { eq, asc } from "drizzle-orm"
import { getAllSpecies as getSpeciesFromDb } from "@/features/species/db/species"

export type CategoryOption = { id: string; name: string; slug: string }

export type CategoryWithParent = CategoryOption & {
  parentId: string | null
  sortOrder: number
}

export type CategoryTreeNode = CategoryOption & {
  children: CategoryTreeNode[]
  isLeaf: boolean
}

export type CategoryForEdit = CategoryOption & {
  parentId: string | null
  description: string | null
  sortOrder: number
  speciesIds: string[]
}

export async function getAllCategories(): Promise<CategoryOption[]> {
  const rows = await db
    .select({
      id: productCategory.id,
      name: productCategory.name,
      slug: productCategory.slug,
    })
    .from(productCategory)
    .orderBy(productCategory.name)

  return rows
}

export async function getCategoriesWithParent(): Promise<CategoryWithParent[]> {
  return db
    .select({
      id: productCategory.id,
      name: productCategory.name,
      slug: productCategory.slug,
      parentId: productCategory.parentId,
      sortOrder: productCategory.sortOrder,
    })
    .from(productCategory)
    .orderBy(asc(productCategory.sortOrder), asc(productCategory.name))
}

export async function getCategoriesTree(): Promise<CategoryTreeNode[]> {
  const rows = await getCategoriesWithParent()
  const byId = new Map<string, CategoryTreeNode & { parentId: string | null }>()
  const roots: CategoryTreeNode[] = []

  for (const r of rows) {
    const node: CategoryTreeNode & { parentId: string | null } = {
      ...r,
      parentId: r.parentId,
      children: [],
      isLeaf: true,
    }
    byId.set(r.id, node)
  }

  for (const r of rows) {
    const node = byId.get(r.id)!
    const parent = r.parentId ? byId.get(r.parentId) : null
    if (parent) {
      parent.children.push(node)
      parent.isLeaf = false
    } else {
      roots.push(node)
    }
  }

  return roots
}

export async function getCategoryById(id: string): Promise<CategoryForEdit | null> {
  const row = await db
    .select({
      id: productCategory.id,
      name: productCategory.name,
      slug: productCategory.slug,
      parentId: productCategory.parentId,
      description: productCategory.description,
      sortOrder: productCategory.sortOrder,
    })
    .from(productCategory)
    .where(eq(productCategory.id, id))
    .limit(1)

  if (!row[0]) return null

  const speciesRows = await db
    .select({ speciesId: categorySpecies.speciesId })
    .from(categorySpecies)
    .where(eq(categorySpecies.categoryId, id))

  return {
    ...row[0],
    speciesIds: speciesRows.map((r) => r.speciesId),
  }
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function createCategoryInDb(input: {
  name: string
  slug?: string
  parentId?: string | null
  description?: string | null
  sortOrder?: number
  speciesIds?: string[]
}): Promise<string> {
  const slug = input.slug ?? slugFromName(input.name)

  const [inserted] = await db
    .insert(productCategory)
    .values({
      name: input.name,
      slug,
      parentId: input.parentId ?? null,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning({ id: productCategory.id })

  const categoryId = inserted!.id

  const ids = input.speciesIds ?? []
  if (ids.length > 0) {
    await db.insert(categorySpecies).values(
      ids.map((speciesId) => ({ categoryId, speciesId }))
    )
  }

  return categoryId
}

export async function updateCategoryInDb(
  id: string,
  input: {
    name?: string
    slug?: string
    parentId?: string | null
    description?: string | null
    sortOrder?: number
    speciesIds?: string[]
  }
): Promise<boolean> {
  const { speciesIds, ...rest } = input
  const updates = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined)
  )

  if (Object.keys(updates).length > 0) {
    await db.update(productCategory).set(updates).where(eq(productCategory.id, id))
  }

  if (speciesIds !== undefined) {
    await db.delete(categorySpecies).where(eq(categorySpecies.categoryId, id))
    if (speciesIds.length > 0) {
      await db.insert(categorySpecies).values(
        speciesIds.map((speciesId) => ({ categoryId: id, speciesId }))
      )
    }
  }

  return true
}

export async function deleteCategoryInDb(id: string): Promise<boolean> {
  const deleted = await db
    .delete(productCategory)
    .where(eq(productCategory.id, id))
    .returning({ id: productCategory.id })

  return deleted.length > 0
}

export type SpeciesOption = { id: string; name: string; slug: string }

export async function getAllSpecies(): Promise<SpeciesOption[]> {
  return getSpeciesFromDb()
}

/** Species available per category (from category_species). Used to filter product form. */
export async function getSpeciesByCategoryMap(): Promise<Record<string, SpeciesOption[]>> {
  const links = await db
    .select({
      categoryId: categorySpecies.categoryId,
      speciesId: species.id,
      name: species.name,
      slug: species.slug,
    })
    .from(categorySpecies)
    .innerJoin(species, eq(categorySpecies.speciesId, species.id))

  const map: Record<string, SpeciesOption[]> = {}
  for (const row of links) {
    const opt: SpeciesOption = { id: row.speciesId, name: row.name, slug: row.slug }
    if (!map[row.categoryId]) map[row.categoryId] = []
    map[row.categoryId].push(opt)
  }
  for (const arr of Object.values(map)) {
    arr.sort((a, b) => a.name.localeCompare(b.name))
  }
  return map
}

import { db } from "@/drizzle/db"
import { species } from "@/drizzle/schema/category-schema"
import { eq } from "drizzle-orm"

export type SpeciesOption = { id: string; name: string; slug: string }

export type SpeciesForEdit = SpeciesOption

export async function getAllSpecies(): Promise<SpeciesOption[]> {
  return db
    .select({
      id: species.id,
      name: species.name,
      slug: species.slug,
    })
    .from(species)
    .orderBy(species.name)
}

export async function getSpeciesById(id: string): Promise<SpeciesForEdit | null> {
  const row = await db
    .select({
      id: species.id,
      name: species.name,
      slug: species.slug,
    })
    .from(species)
    .where(eq(species.id, id))
    .limit(1)

  return row[0] ?? null
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function createSpeciesInDb(input: {
  name: string
  slug?: string
}): Promise<string> {
  const slug = input.slug ?? slugFromName(input.name)

  const [inserted] = await db
    .insert(species)
    .values({ name: input.name, slug })
    .returning({ id: species.id })

  return inserted!.id
}

export async function updateSpeciesInDb(
  id: string,
  input: { name?: string; slug?: string }
): Promise<boolean> {
  const updates = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined)
  )

  if (Object.keys(updates).length === 0) return true

  await db.update(species).set(updates).where(eq(species.id, id))
  return true
}

export async function deleteSpeciesInDb(id: string): Promise<boolean> {
  const deleted = await db
    .delete(species)
    .where(eq(species.id, id))
    .returning({ id: species.id })

  return deleted.length > 0
}

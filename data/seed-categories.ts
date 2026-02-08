/**
 * Category seed - product category hierarchy and category_species
 *
 * Loose Stones (root)
 *   ├── Faceted  → Ruby, Sapphire, Spinel
 *   └── Cabochon → Ruby, Jadeite, Spinel
 *
 * Jewelry (root)
 *   ├── Rings    → all species
 *   ├── Pendants → all species
 *   └── Earrings → all species
 *
 * Run: npm run seed:categories (run seed:species first)
 */
import "dotenv/config"
import { db } from "@/drizzle/db"
import {
  productCategory,
  categorySpecies,
  species,
} from "@/drizzle/schema/category-schema"
import { eq, and } from "drizzle-orm"

type CategoryDef = {
  slug: string
  name: string
  parentSlug?: string
  sortOrder: number
  speciesSlugs?: string[]
}

const CATEGORIES: CategoryDef[] = [
  { slug: "loose-stones", name: "Loose Stones", sortOrder: 0 },
  { slug: "faceted", name: "Faceted", parentSlug: "loose-stones", sortOrder: 0, speciesSlugs: ["ruby", "sapphire", "spinel"] },
  { slug: "cabochon", name: "Cabochon", parentSlug: "loose-stones", sortOrder: 1, speciesSlugs: ["ruby", "jadeite", "spinel"] },
  { slug: "jewelry", name: "Jewelry", sortOrder: 1 },
  { slug: "rings", name: "Rings", parentSlug: "jewelry", sortOrder: 0 },
  { slug: "pendants", name: "Pendants", parentSlug: "jewelry", sortOrder: 1 },
  { slug: "earrings", name: "Earrings", parentSlug: "jewelry", sortOrder: 2 },
]

const JEWELRY_SUBCAT_SPECIES = ["ruby", "sapphire", "emerald", "spinel", "jadeite", "diamond"]

async function main() {
  const slugsToId = new Map<string, string>()

  // 1. Insert root categories
  for (const c of CATEGORIES.filter((c) => !c.parentSlug)) {
    const existing = await db
      .select({ id: productCategory.id })
      .from(productCategory)
      .where(eq(productCategory.slug, c.slug))
      .limit(1)

    if (existing.length > 0) {
      slugsToId.set(c.slug, existing[0].id)
      console.log(`Category "${c.name}" already exists. Skipping.`)
    } else {
      const [inserted] = await db
        .insert(productCategory)
        .values({ name: c.name, slug: c.slug, sortOrder: c.sortOrder })
        .returning({ id: productCategory.id })
      if (inserted) {
        slugsToId.set(c.slug, inserted.id)
        console.log(`Created category: ${c.name}`)
      }
    }
  }

  // 2. Insert subcategories
  for (const c of CATEGORIES.filter((c) => c.parentSlug)) {
    const existing = await db
      .select({ id: productCategory.id })
      .from(productCategory)
      .where(eq(productCategory.slug, c.slug))
      .limit(1)

    const parentId = slugsToId.get(c.parentSlug!) ?? null

    if (existing.length > 0) {
      slugsToId.set(c.slug, existing[0].id)
      console.log(`Category "${c.name}" already exists. Skipping.`)
    } else if (parentId) {
      const [inserted] = await db
        .insert(productCategory)
        .values({
          name: c.name,
          slug: c.slug,
          parentId,
          sortOrder: c.sortOrder,
        })
        .returning({ id: productCategory.id })
      if (inserted) {
        slugsToId.set(c.slug, inserted.id)
        console.log(`Created category: ${c.name} (under ${c.parentSlug})`)
      }
    }
  }

  // 3. Get species by slug
  const allSpecies = await db.select({ id: species.id, slug: species.slug }).from(species)
  const speciesBySlug = new Map(allSpecies.map((s) => [s.slug, s.id]))

  // 4. Insert category_species
  for (const c of CATEGORIES) {
    const categoryId = slugsToId.get(c.slug)
    if (!categoryId) continue

    const slugs = c.speciesSlugs ?? (c.parentSlug === "jewelry" ? JEWELRY_SUBCAT_SPECIES : [])
    for (const slug of slugs) {
      const speciesId = speciesBySlug.get(slug)
      if (!speciesId) {
        console.warn(`Species "${slug}" not found. Run seed:species first.`)
        continue
      }

      const existing = await db
        .select()
        .from(categorySpecies)
        .where(and(eq(categorySpecies.categoryId, categoryId), eq(categorySpecies.speciesId, speciesId)))
        .limit(1)

      if (existing.length === 0) {
        await db.insert(categorySpecies).values({ categoryId, speciesId })
        console.log(`Linked ${c.name} → ${slug}`)
      }
    }
  }

  console.log("Category seed complete.")
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

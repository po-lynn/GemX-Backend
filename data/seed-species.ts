/**
 * Species seed - gem species for product classification
 * Ruby, Sapphire, Emerald, Spinel, Jadeite, Diamond (from product schema)
 *
 * Run: npm run seed:species
 */
import "dotenv/config"
import { db } from "@/drizzle/db"
import { species } from "@/drizzle/schema/category-schema"
import { eq } from "drizzle-orm"

const SPECIES = [
  { slug: "ruby", name: "Ruby" },
  { slug: "sapphire", name: "Sapphire" },
  { slug: "emerald", name: "Emerald" },
  { slug: "spinel", name: "Spinel" },
  { slug: "jadeite", name: "Jadeite" },
  { slug: "diamond", name: "Diamond" },
]

async function main() {
  for (const s of SPECIES) {
    const existing = await db
      .select({ id: species.id })
      .from(species)
      .where(eq(species.slug, s.slug))
      .limit(1)

    if (existing.length > 0) {
      console.log(`Species "${s.name}" already exists. Skipping.`)
      continue
    }

    await db.insert(species).values({ name: s.name, slug: s.slug })
    console.log(`Created species: ${s.name}`)
  }

  console.log("Species seed complete.")
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

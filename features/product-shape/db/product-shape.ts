import { db } from "@/drizzle/db"
import { productShapes } from "@/drizzle/schema/product-shape-schema"
import { eq } from "drizzle-orm"

export type ProductShapeOption = {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export type ProductShapeForEdit = ProductShapeOption

export async function getAllProductShapes(): Promise<ProductShapeOption[]> {
  return db
    .select({
      id: productShapes.id,
      name: productShapes.name,
      createdAt: productShapes.createdAt,
      updatedAt: productShapes.updatedAt,
    })
    .from(productShapes)
    .orderBy(productShapes.name)
}

export async function getProductShapeById(
  id: string,
): Promise<ProductShapeForEdit | null> {
  const row = await db
    .select({
      id: productShapes.id,
      name: productShapes.name,
      createdAt: productShapes.createdAt,
      updatedAt: productShapes.updatedAt,
    })
    .from(productShapes)
    .where(eq(productShapes.id, id))
    .limit(1)
  return row[0] ?? null
}

export async function createProductShapeInDb(input: {
  name: string
}): Promise<string> {
  const [inserted] = await db
    .insert(productShapes)
    .values({ name: input.name })
    .returning({ id: productShapes.id })
  return inserted!.id
}

export async function updateProductShapeInDb(
  id: string,
  input: { name?: string },
): Promise<boolean> {
  const updates = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  )
  if (Object.keys(updates).length === 0) return true
  await db.update(productShapes).set(updates).where(eq(productShapes.id, id))
  return true
}

export async function deleteProductShapeInDb(id: string): Promise<boolean> {
  const deleted = await db
    .delete(productShapes)
    .where(eq(productShapes.id, id))
    .returning({ id: productShapes.id })
  return deleted.length > 0
}

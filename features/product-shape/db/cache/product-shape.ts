import { cacheTag, cacheLife, updateTag } from "next/cache"
import { getGlobalTag, getIdTag } from "@/lib/dataCache"
import {
  getAllProductShapes,
  getProductShapeById,
} from "../product-shape"
import type { ProductShapeOption, ProductShapeForEdit } from "../product-shape"

function getProductShapeGlobalTag() {
  return getGlobalTag("productShape")
}

function getProductShapeIdTag(id: string) {
  return getIdTag("productShape", id)
}

export async function getCachedProductShapes(): Promise<ProductShapeOption[]> {
  "use cache"
  cacheTag(getProductShapeGlobalTag())
  cacheLife("max")
  return getAllProductShapes()
}

export async function getCachedProductShapeById(
  id: string,
): Promise<ProductShapeForEdit | null> {
  "use cache"
  cacheTag(getProductShapeGlobalTag(), getProductShapeIdTag(id))
  cacheLife("max")
  return getProductShapeById(id)
}

export function revalidateProductShapeCache(id?: string) {
  updateTag(getProductShapeGlobalTag())
  if (id) updateTag(getProductShapeIdTag(id))
}

import { cacheTag, updateTag } from "next/cache"
import { getGlobalTag, getIdTag } from "@/lib/dataCache"
import {
  getAdminProductsFromDb,
  getProductById,
  getAllCategories,
} from "../products"
import type { ProductForEdit } from "../products"
import type { CategoryOption } from "../products"

export function getProductsGlobalTag() {
  return getGlobalTag("products")
}

export function getProductIdTag(id: string) {
  return getIdTag("products", id)
}

export function getCategoriesGlobalTag() {
  return getGlobalTag("categories")
}

export async function getCachedProduct(id: string): Promise<ProductForEdit | null> {
  "use cache"
  cacheTag(getProductIdTag(id))
  return getProductById(id)
}

export async function getCachedCategories(): Promise<CategoryOption[]> {
  "use cache"
  cacheTag(getCategoriesGlobalTag())
  return getAllCategories()
}

export async function getAdminProducts(opts: {
  page?: number
  limit?: number
  search?: string
}) {
  "use cache"
  cacheTag(getProductsGlobalTag())

  return getAdminProductsFromDb(opts)
}

export function revalidateProductsCache(id?: string) {
  updateTag(getProductsGlobalTag())
  if (id) {
    updateTag(getProductIdTag(id))
  }
}

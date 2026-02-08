import { cacheTag, updateTag } from "next/cache"
import { getGlobalTag, getIdTag } from "@/lib/dataCache"
import {
  getAdminProductsFromDb,
  getProductById,
} from "../products"
import type { ProductForEdit } from "../products"
import type { CategoryOption, CategoryTreeNode, SpeciesOption } from "../products"
import {
  getCachedCategories as getCategories,
  getCachedCategoriesTree as getCategoriesTree,
  getCachedSpecies as getSpecies,
  getCachedSpeciesByCategoryMap as getSpeciesByCategory,
} from "@/features/categories/db/cache/categories"

export function getProductsGlobalTag() {
  return getGlobalTag("products")
}

export function getProductIdTag(id: string) {
  return getIdTag("products", id)
}

export function getCategoriesGlobalTag() {
  return getGlobalTag("categories")
}

export function getSpeciesGlobalTag() {
  return getGlobalTag("species")
}

export async function getCachedProduct(id: string): Promise<ProductForEdit | null> {
  "use cache"
  cacheTag(getProductIdTag(id))
  return getProductById(id)
}

export async function getCachedCategories(): Promise<CategoryOption[]> {
  return getCategories()
}

export async function getCachedCategoriesTree(): Promise<CategoryTreeNode[]> {
  return getCategoriesTree()
}

export async function getCachedSpecies(): Promise<SpeciesOption[]> {
  return getSpecies()
}

export async function getCachedSpeciesByCategoryMap(): Promise<
  Record<string, SpeciesOption[]>
> {
  return getSpeciesByCategory()
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

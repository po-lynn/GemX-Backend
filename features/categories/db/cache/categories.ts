import { cacheTag, updateTag } from "next/cache"
import { getGlobalTag, getIdTag } from "@/lib/dataCache"
import {
  getAllCategories,
  getCategoriesTree,
  getCategoryById,
  getAllSpecies,
  getSpeciesByCategoryMap,
} from "../categories"
import type {
  CategoryOption,
  CategoryTreeNode,
  CategoryForEdit,
  SpeciesOption,
} from "../categories"

export function getCategoriesGlobalTag() {
  return getGlobalTag("categories")
}

export function getCategoryIdTag(id: string) {
  return getIdTag("categories", id)
}

export async function getCachedCategories(): Promise<CategoryOption[]> {
  "use cache"
  cacheTag(getCategoriesGlobalTag())
  return getAllCategories()
}

export async function getCachedCategoriesTree(): Promise<CategoryTreeNode[]> {
  "use cache"
  cacheTag(getCategoriesGlobalTag())
  return getCategoriesTree()
}

export async function getCachedCategory(id: string): Promise<CategoryForEdit | null> {
  "use cache"
  cacheTag(getCategoriesGlobalTag(), getCategoryIdTag(id))
  return getCategoryById(id)
}

export async function getCachedSpecies(): Promise<SpeciesOption[]> {
  "use cache"
  cacheTag(getCategoriesGlobalTag())
  return getAllSpecies()
}

export async function getCachedSpeciesByCategoryMap(): Promise<
  Record<string, SpeciesOption[]>
> {
  "use cache"
  cacheTag(getCategoriesGlobalTag())
  return getSpeciesByCategoryMap()
}

export function revalidateCategoriesCache(id?: string) {
  updateTag(getCategoriesGlobalTag())
  if (id) {
    updateTag(getCategoryIdTag(id))
  }
}

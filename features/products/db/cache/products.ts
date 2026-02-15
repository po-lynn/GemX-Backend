import { cacheTag, revalidateTag } from "next/cache"
import { getGlobalTag, getIdTag } from "@/lib/dataCache"
import {
  getAdminProductsFromDb,
  getProductById,
} from "../products"
import type { ProductForEdit } from "../products"

export function getProductsGlobalTag() {
  return getGlobalTag("products")
}

export function getProductIdTag(id: string) {
  return getIdTag("products", id)
}

export async function getCachedProduct(id: string): Promise<ProductForEdit | null> {
  "use cache"
  cacheTag(getProductIdTag(id))
  return getProductById(id)
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

/** Invalidate products cache (use in Route Handlers or Server Actions). */
export function revalidateProductsCache(id?: string) {
  revalidateTag(getProductsGlobalTag(), "max")
  if (id) {
    revalidateTag(getProductIdTag(id), "max")
  }
}

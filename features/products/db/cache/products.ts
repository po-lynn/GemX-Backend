import { cacheTag, revalidateTag } from "next/cache"
import { getGlobalTag, getIdTag } from "@/lib/dataCache"
import {
  getAdminProductsFromDb,
  getProductById,
  getProductsBySellerId,
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
  productType?: "loose_stone" | "jewellery"
  categoryId?: string | null
  status?: "active" | "archive" | "sold" | "hidden"
  stoneCut?: "Faceted" | "Cabochon"
  shape?: "Oval" | "Cushion" | "Round" | "Pear" | "Heart"
  origin?: string
  laboratoryId?: string | null
}) {
  "use cache"
  cacheTag(getProductsGlobalTag())

  return getAdminProductsFromDb(opts)
}

export async function getCachedProductsBySellerId(
  sellerId: string,
  opts: {
    page?: number
    limit?: number
    search?: string
    productType?: "loose_stone" | "jewellery"
    categoryId?: string | null
    status?: "active" | "archive" | "sold" | "hidden"
    stoneCut?: "Faceted" | "Cabochon"
    shape?: "Oval" | "Cushion" | "Round" | "Pear" | "Heart"
    origin?: string
    laboratoryId?: string | null
  }
) {
  "use cache"
  cacheTag(getProductsGlobalTag())
  return getProductsBySellerId(sellerId, opts)
}

/** Invalidate products cache (use in Route Handlers or Server Actions). */
export function revalidateProductsCache(id?: string) {
  revalidateTag(getProductsGlobalTag(), "max")
  if (id) {
    revalidateTag(getProductIdTag(id), "max")
  }
}

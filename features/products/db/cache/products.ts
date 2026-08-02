import { cacheTag, cacheLife, revalidateTag } from "next/cache"
import { getGlobalTag, getIdTag } from "@/lib/dataCache"
import {
  getAdminProductsFromDb,
  getAdminProductCountsFromDb,
  getPortalProductCountsFromDb,
  getProductById,
  getProductsBySellerId,
} from "../products"
import type { ProductForEdit } from "../products"

function getProductsGlobalTag() {
  return getGlobalTag("products")
}

function getProductIdTag(id: string) {
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
  status?: "draft" | "pending" | "active" | "archive" | "sold"
  excludeStatuses?: ReadonlyArray<"draft" | "pending" | "active" | "archive" | "sold">
  moderationStatus?: "pending" | "approved" | "rejected"
  excludeModerationStatuses?: ReadonlyArray<"pending" | "approved" | "rejected">
  stoneCut?: "Faceted" | "Cabochon"
  metal?: "Gold" | "Silver" | "Other"
  identification?: "Natural" | "Heat Treated" | "Treatments" | "Others"
  shape?: "Oval" | "Cushion" | "Round" | "Pear" | "Heart"
  origin?: string
  laboratoryId?: string | null
  createdFrom?: string
  createdTo?: string
  isFeatured?: boolean
  isCollectorPiece?: boolean
  collectorPieceApprovedForUserId?: string
  isPrivilegeAssist?: boolean
  sortByPublicPriority?: boolean
  sortBy?: "createdAt" | "title" | "price" | "status"
  sortOrder?: "asc" | "desc"
  priceMinUSD?: number
  priceMaxUSD?: number
  priceMinMMK?: number
  priceMaxMMK?: number
}) {
  "use cache"
  cacheTag(getProductsGlobalTag())

  return getAdminProductsFromDb(opts)
}

/**
 * Public Privilege Assist browse (random order, no search/sort/newest override).
 * Was previously re-hit on every single request with `random: true` and served
 * uncached (see git history on app/api/products/route.ts) — every Home-tab load
 * therefore issued a fresh, uncacheable `ORDER BY random()` query straight to
 * Postgres. Caching the shuffle for a short window turns "reshuffle on every
 * request" into "reshuffle every ~30s", trading a small amount of randomness
 * freshness for a large cut in DB round-trips on this hot path.
 */
export async function getPrivilegeAssistBrowse(opts: {
  page?: number
  limit?: number
  productType?: "loose_stone" | "jewellery"
  categoryId?: string | null
  status?: "draft" | "pending" | "active" | "archive" | "sold"
  excludeModerationStatuses?: ReadonlyArray<"pending" | "approved" | "rejected">
  stoneCut?: "Faceted" | "Cabochon"
  metal?: "Gold" | "Silver" | "Other"
  identification?: "Natural" | "Heat Treated" | "Treatments" | "Others"
  shape?: "Oval" | "Cushion" | "Round" | "Pear" | "Heart"
  origin?: string
  laboratoryId?: string | null
  createdFrom?: string
  createdTo?: string
  isFeatured?: boolean
  isCollectorPiece?: boolean
}) {
  "use cache"
  cacheTag(getProductsGlobalTag())
  cacheLife({ stale: 30, revalidate: 30, expire: 90 })
  return getAdminProductsFromDb({ ...opts, isPrivilegeAssist: true, random: true })
}

export async function getCachedProductsBySellerId(
  sellerId: string,
  opts: {
    page?: number
    limit?: number
    search?: string
    productType?: "loose_stone" | "jewellery"
    categoryId?: string | null
    status?: "draft" | "pending" | "active" | "archive" | "sold"
    moderationStatus?: "pending" | "approved" | "rejected"
    stoneCut?: "Faceted" | "Cabochon"
    metal?: "Gold" | "Silver" | "Other"
    identification?: "Natural" | "Heat Treated" | "Treatments" | "Others"
    shape?: "Oval" | "Cushion" | "Round" | "Pear" | "Heart"
    origin?: string
    laboratoryId?: string | null
    createdFrom?: string
    createdTo?: string
    isFeatured?: boolean
    isCollectorPiece?: boolean
    isPrivilegeAssist?: boolean
    sortByPublicPriority?: boolean
    sortBy?: "createdAt" | "title" | "price" | "status"
    sortOrder?: "asc" | "desc"
  }
) {
  "use cache"
  cacheTag(getProductsGlobalTag())
  return getProductsBySellerId(sellerId, opts)
}

export async function getAdminProductCounts() {
  "use cache"
  cacheTag(getProductsGlobalTag())
  return getAdminProductCountsFromDb()
}

export async function getPortalProductCounts(sellerId: string): Promise<{
  all: number
  pending: number
  featured: number
  collector: number
  sold: number
  drafts: number
}> {
  "use cache"
  cacheTag(getProductsGlobalTag())
  return getPortalProductCountsFromDb(sellerId)
}

/**
 * Invalidate products cache (use in Route Handlers or Server Actions).
 * Must use revalidateTag(tag, "max"), NOT updateTag: this is called from
 * Route Handlers (POST /api/products etc.) where updateTag throws in Next 16.
 */
export function revalidateProductsCache(id?: string) {
  revalidateTag(getProductsGlobalTag(), "max")
  if (id) {
    revalidateTag(getProductIdTag(id), "max")
  }
}

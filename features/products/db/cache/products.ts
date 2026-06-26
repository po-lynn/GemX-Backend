import { cacheTag, updateTag } from "next/cache"
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

/** Invalidate products cache (use in Route Handlers or Server Actions). */
export function revalidateProductsCache(id?: string) {
  updateTag(getProductsGlobalTag())
  if (id) {
    updateTag(getProductIdTag(id))
  }
}

import { db } from "@/drizzle/db"
import {
  product,
  productAdminChangeLog,
  productImage,
  productJewelleryGemstone,
  productVideo,
} from "@/drizzle/schema/product-schema"
import { category } from "@/drizzle/schema/category-schema"
import { laboratory } from "@/drizzle/schema/laboratory-schema"
import { user } from "@/drizzle/schema/auth-schema"
import { collectorPieceShowRequest } from "@/drizzle/schema/collector-piece-show-request-schema"
import { and, asc, eq, exists, gt, gte, ilike, inArray, isNull, lte, or, sql, desc } from "drizzle-orm"
import type {
  ProductCreate,
  ProductIdentification,
} from "@/features/products/schemas/products"
import type { GemstoneSpec } from "@/features/products/schemas/gemstone-spec"

/** Stable line for comparing / storing price + currency in change log */
function formatPriceLineForLog(currency: string, price: string): string {
  const n = Number(price)
  const dec = Number.isFinite(n) ? n.toFixed(2) : price.trim()
  return `${currency} ${dec}`
}

/** Escape a string for safe use in ILIKE patterns (%, _, \). */
function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

/** Same spec shape as loose stone; used for jewellery piece gemstones (with categoryId/categoryName). */
export type JewelleryGemstoneRow = GemstoneSpec & {
  categoryId: string
  categoryName: string
  weightCarat: string
  pieceCount: number | null
}

export type AdminProductRow = {
  id: string
  sku: string | null
  title: string
  description: string | null
  identification: string | null
  price: string
  currency: "USD" | "MMK"
  productType: "loose_stone" | "jewellery"
  categoryId: string | null
  categoryName: string | null
  stoneCut: "Faceted" | "Cabochon" | null
  metal: "Gold" | "Silver" | "Other" | null
  status: "pending" | "active" | "archive" | "sold" | "hidden"
  moderationStatus: "pending" | "approved" | "rejected"
  isFeatured: boolean
  isCollectorPiece: boolean
  isPrivilegeAssist: boolean
  isPromotion: boolean
  /** List / “was” price when on promotion; used to compute savings vs `price` */
  promotionComparePrice: string | null
  laboratoryId: string | null
  sellerId: string
  sellerName: string
  sellerPhone: string | null
  imageUrl: string | null
  createdAt: Date
}

export async function getAdminProductsFromDb(opts: {
  page?: number
  limit?: number
  search?: string
  productType?: "loose_stone" | "jewellery"
  categoryId?: string | null
  status?: "pending" | "active" | "archive" | "sold" | "hidden"
  stoneCut?: "Faceted" | "Cabochon"
  metal?: "Gold" | "Silver" | "Other"
  identification?: ProductIdentification
  shape?: "Oval" | "Cushion" | "Round" | "Pear" | "Heart"
  origin?: string
  laboratoryId?: string | null
  /** Filter by created date (YYYY-MM-DD), inclusive range */
  createdFrom?: string
  createdTo?: string
  isFeatured?: boolean
  isCollectorPiece?: boolean
  /** When set with `isCollectorPiece: true`, only products with an approved `collector_piece_show_request` for this user are returned. */
  collectorPieceApprovedForUserId?: string
  isPrivilegeAssist?: boolean
  isPromotion?: boolean
  /** When true, sort for public list: collector pieces first, then privilege assist, then featured, then by latest date */
  sortByPublicPriority?: boolean
  /** Admin list sort column */
  sortBy?: "createdAt" | "title" | "price" | "status"
  /** Admin list sort direction */
  sortOrder?: "asc" | "desc"
}): Promise<{ products: AdminProductRow[]; total: number }> {
  const page = opts.page ?? 1
  const limit = Math.min(opts.limit ?? 20, 100)
  const offset = (page - 1) * limit
  const search = opts.search?.trim()

  // Full-text search on title/description (uses product_title_description_fts_idx when scripts/postgres-fulltext-search.sql is run) plus ILIKE on seller
  const searchCondition = search
    ? or(
        sql`to_tsvector('english', coalesce(${product.title}, '') || ' ' || coalesce(${product.description}, '')) @@ plainto_tsquery('english', ${search})`,
        ilike(product.title, `%${escapeLike(search)}%`),
        ilike(user.name, `%${escapeLike(search)}%`),
        ilike(user.phone ?? "", `%${escapeLike(search)}%`),
        ilike(user.email, `%${escapeLike(search)}%`)
      )
    : undefined

  const categoryCondition =
    opts.categoryId != null
      ? or(
          eq(product.categoryId, opts.categoryId),
          exists(
            db
              .select()
              .from(productJewelleryGemstone)
              .where(
                and(
                  eq(productJewelleryGemstone.productId, product.id),
                  eq(productJewelleryGemstone.categoryId, opts.categoryId)
                )
              )
          )
        )
      : undefined

  const createdFromDate = opts.createdFrom
    ? new Date(opts.createdFrom + "T00:00:00.000Z")
    : undefined
  const createdToDate = opts.createdTo
    ? new Date(opts.createdTo + "T23:59:59.999Z")
    : undefined

  const filterConditions = [
    searchCondition,
    opts.productType ? eq(product.productType, opts.productType) : undefined,
    categoryCondition,
    opts.status ? eq(product.status, opts.status) : undefined,
    opts.stoneCut ? eq(product.stoneCut, opts.stoneCut) : undefined,
    opts.metal ? eq(product.metal, opts.metal) : undefined,
    opts.identification ? eq(product.identification, opts.identification) : undefined,
    opts.shape ? eq(product.shape, opts.shape) : undefined,
    opts.origin?.trim() ? eq(product.origin, opts.origin.trim()) : undefined,
    opts.laboratoryId != null ? eq(product.laboratoryId, opts.laboratoryId) : undefined,
    createdFromDate ? gte(product.createdAt, createdFromDate) : undefined,
    createdToDate ? lte(product.createdAt, createdToDate) : undefined,
    opts.isFeatured === true
      ? and(
          eq(product.isFeatured, true),
          or(isNull(product.featuredExpiresAt), gt(product.featuredExpiresAt, sql`now()`))
        )
      : opts.isFeatured === false
        ? eq(product.isFeatured, false)
        : undefined,
    opts.isCollectorPiece === true ? eq(product.isCollectorPiece, true) : undefined,
    opts.collectorPieceApprovedForUserId && opts.isCollectorPiece === true
      ? exists(
          db
            .select()
            .from(collectorPieceShowRequest)
            .where(
              and(
                eq(collectorPieceShowRequest.productId, product.id),
                eq(collectorPieceShowRequest.userId, opts.collectorPieceApprovedForUserId),
                eq(collectorPieceShowRequest.status, "approved")
              )
            )
        )
      : undefined,
    opts.isPrivilegeAssist === true ? eq(product.isPrivilegeAssist, true) : undefined,
    opts.isPromotion === true ? eq(product.isPromotion, true) : undefined,
  ].filter(Boolean)

  const whereClause =
    filterConditions.length > 0 ? and(...filterConditions) : undefined

  const orderByColumns = opts.sortByPublicPriority
    ? search
      ? [
          desc(sql`ts_rank(to_tsvector('english', coalesce(${product.title}, '') || ' ' || coalesce(${product.description}, '')), plainto_tsquery('english', ${search}))`),
          desc(product.isCollectorPiece),
          desc(product.isPrivilegeAssist),
          desc(sql`(${product.isFeatured} AND (${product.featuredExpiresAt} IS NULL OR ${product.featuredExpiresAt} > now()))`),
          desc(product.featured),
          desc(product.isPromotion),
          desc(product.createdAt),
        ]
      : [
          desc(product.isCollectorPiece),
          desc(product.isPrivilegeAssist),
          desc(sql`(${product.isFeatured} AND (${product.featuredExpiresAt} IS NULL OR ${product.featuredExpiresAt} > now()))`),
          desc(product.featured),
          desc(product.isPromotion),
          desc(product.createdAt),
        ]
    : (() => {
        const dir = opts.sortOrder === "asc" ? asc : desc
        switch (opts.sortBy) {
          case "title":
            return [dir(product.title), desc(product.createdAt)]
          case "price":
            return [dir(product.price), desc(product.createdAt)]
          case "status":
            return [dir(product.status), desc(product.createdAt)]
          case "createdAt":
          default:
            return [dir(product.createdAt)]
        }
      })()

  const productsData = await db
    .select({
      id: product.id,
      sku: product.sku,
      title: product.title,
      description: product.description,
      identification: product.identification,
      price: product.price,
      currency: product.currency,
      productType: product.productType,
      categoryId: product.categoryId,
      categoryName: category.name,
      stoneCut: product.stoneCut,
      metal: product.metal,
      laboratoryId: product.laboratoryId,
      status: product.status,
      moderationStatus: product.moderationStatus,
      isFeatured: sql<boolean>`(${product.isFeatured} AND (${product.featuredExpiresAt} IS NULL OR ${product.featuredExpiresAt} > now()))`,
      isCollectorPiece: product.isCollectorPiece,
      isPrivilegeAssist: product.isPrivilegeAssist,
      isPromotion: product.isPromotion,
      promotionComparePrice: product.promotionComparePrice,
      sellerId: product.sellerId,
      sellerName: user.name,
      sellerPhone: user.phone,
      createdAt: product.createdAt,
    })
    .from(product)
    .innerJoin(user, eq(product.sellerId, user.id))
    .leftJoin(category, eq(product.categoryId, category.id))
    .leftJoin(laboratory, eq(product.laboratoryId, laboratory.id))
    .where(whereClause)
    .orderBy(...orderByColumns)
    .limit(limit)
    .offset(offset)

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(product)
    .innerJoin(user, eq(product.sellerId, user.id))
    .where(whereClause)

  const productIds = productsData.map((p) => p.id)
  const images =
    productIds.length > 0
      ? await db
          .select({
            productId: productImage.productId,
            url: productImage.url,
            sortOrder: productImage.sortOrder,
          })
          .from(productImage)
          .where(inArray(productImage.productId, productIds))
          .orderBy(productImage.sortOrder)
      : []

  const imageByProduct = new Map<string, string>()
  for (const img of images) {
    if (!imageByProduct.has(img.productId)) {
      imageByProduct.set(img.productId, img.url)
    }
  }

  const products: AdminProductRow[] = productsData.map((p) => ({
    id: p.id,
    sku: p.sku,
    title: p.title,
    description: p.description,
    identification: p.identification ?? null,
    price: String(p.price),
    currency: p.currency,
    productType: p.productType,
    categoryId: p.categoryId,
    categoryName: p.categoryName ?? null,
    stoneCut: p.stoneCut,
    metal: p.metal,
    status: p.status,
    laboratoryId: p.laboratoryId,
    moderationStatus: p.moderationStatus,
    isFeatured: p.isFeatured,
    isCollectorPiece: p.isCollectorPiece,
    isPrivilegeAssist: p.isPrivilegeAssist,
    isPromotion: p.isPromotion,
    promotionComparePrice:
      p.promotionComparePrice != null ? String(p.promotionComparePrice) : null,
    sellerId: p.sellerId,
    sellerName: p.sellerName,
    sellerPhone: p.sellerPhone,
    imageUrl: imageByProduct.get(p.id) ?? null,
    createdAt: p.createdAt,
  }))

  const total = countResult[0]?.count ?? 0

  return { products, total }
}

export type ProductSuggestionRow = { label: string }

/**
 * Returns distinct product title suggestions for autocomplete.
 * Only active products; ordered by starts-with query, then contains, then newest first.
 */
export async function getProductSearchSuggestions(
  q: string,
  limit: number = 5
): Promise<ProductSuggestionRow[]> {
  const trimmed = q?.trim() ?? ""
  if (trimmed.length < 2) return []
  const cap = Math.min(Math.max(limit, 1), 10)
  const escaped = escapeLike(trimmed)
  const patternContains = `%${escaped}%`
  const patternStarts = `${escaped}%`

  const rows = await db
    .select({
      title: product.title,
      createdAt: product.createdAt,
    })
    .from(product)
    .where(
      and(
        eq(product.status, "active"),
        sql`${product.title} ILIKE ${patternContains}`
      )
    )
    .orderBy(
      desc(sql`(${product.title} ILIKE ${patternStarts})`),
      desc(sql`(${product.title} ILIKE ${patternContains})`),
      desc(product.createdAt)
    )
    .limit(50)

  const seen = new Set<string>()
  const out: ProductSuggestionRow[] = []
  for (const row of rows) {
    if (seen.has(row.title)) continue
    seen.add(row.title)
    out.push({ label: row.title })
    if (out.length >= cap) break
  }
  return out
}

export async function getProductsBySellerId(
  sellerId: string,
  opts: {
    page?: number
    limit?: number
    search?: string
    productType?: "loose_stone" | "jewellery"
    categoryId?: string | null
    status?: "pending" | "active" | "archive" | "sold" | "hidden"
    stoneCut?: "Faceted" | "Cabochon"
    metal?: "Gold" | "Silver" | "Other"
    identification?: ProductIdentification
    shape?: "Oval" | "Cushion" | "Round" | "Pear" | "Heart"
    origin?: string
    laboratoryId?: string | null
    isFeatured?: boolean
    isCollectorPiece?: boolean
    isPrivilegeAssist?: boolean
    isPromotion?: boolean
    sortByPublicPriority?: boolean
  }
): Promise<{ products: AdminProductRow[]; total: number }> {
  const page = opts.page ?? 1
  const limit = Math.min(opts.limit ?? 20, 100)
  const offset = (page - 1) * limit
  const search = opts.search?.trim()

  const searchCondition = search
    ? or(
        ilike(product.title, `%${escapeLike(search)}%`),
        ilike(user.name, `%${escapeLike(search)}%`),
        ilike(user.phone ?? "", `%${escapeLike(search)}%`),
        ilike(user.email, `%${escapeLike(search)}%`)
      )
    : undefined

  const categoryConditionSeller =
    opts.categoryId != null
      ? or(
          eq(product.categoryId, opts.categoryId),
          exists(
            db
              .select()
              .from(productJewelleryGemstone)
              .where(
                and(
                  eq(productJewelleryGemstone.productId, product.id),
                  eq(productJewelleryGemstone.categoryId, opts.categoryId)
                )
              )
          )
        )
      : undefined

  const filterConditions = [
    eq(product.sellerId, sellerId),
    searchCondition,
    opts.productType ? eq(product.productType, opts.productType) : undefined,
    categoryConditionSeller,
    opts.status ? eq(product.status, opts.status) : undefined,
    opts.stoneCut ? eq(product.stoneCut, opts.stoneCut) : undefined,
    opts.metal ? eq(product.metal, opts.metal) : undefined,
    opts.identification ? eq(product.identification, opts.identification) : undefined,
    opts.shape ? eq(product.shape, opts.shape) : undefined,
    opts.origin?.trim() ? eq(product.origin, opts.origin.trim()) : undefined,
    opts.laboratoryId != null ? eq(product.laboratoryId, opts.laboratoryId) : undefined,
    opts.isFeatured === true
      ? and(
          eq(product.isFeatured, true),
          or(isNull(product.featuredExpiresAt), gt(product.featuredExpiresAt, sql`now()`))
        )
      : opts.isFeatured === false
        ? eq(product.isFeatured, false)
        : undefined,
    opts.isCollectorPiece === true ? eq(product.isCollectorPiece, true) : undefined,
    opts.isPrivilegeAssist === true ? eq(product.isPrivilegeAssist, true) : undefined,
    opts.isPromotion === true ? eq(product.isPromotion, true) : undefined,
  ].filter(Boolean)

  const whereClause = and(...filterConditions)

  const orderByColumnsSeller = opts.sortByPublicPriority
    ? [
        desc(product.isCollectorPiece),
        desc(product.isPrivilegeAssist),
        desc(sql`(${product.isFeatured} AND (${product.featuredExpiresAt} IS NULL OR ${product.featuredExpiresAt} > now()))`),
        desc(product.featured),
        desc(product.isPromotion),
        desc(product.createdAt),
      ]
    : [desc(product.createdAt)]

  const productsData = await db
    .select({
      id: product.id,
      sku: product.sku,
      title: product.title,
      description: product.description,
      identification: product.identification,
      price: product.price,
      currency: product.currency,
      productType: product.productType,
      categoryId: product.categoryId,
      categoryName: category.name,
      stoneCut: product.stoneCut,
      metal: product.metal,
      laboratoryId: product.laboratoryId,
      status: product.status,
      moderationStatus: product.moderationStatus,
      isFeatured: sql<boolean>`(${product.isFeatured} AND (${product.featuredExpiresAt} IS NULL OR ${product.featuredExpiresAt} > now()))`,
      isCollectorPiece: product.isCollectorPiece,
      isPrivilegeAssist: product.isPrivilegeAssist,
      isPromotion: product.isPromotion,
      promotionComparePrice: product.promotionComparePrice,
      sellerId: product.sellerId,
      sellerName: user.name,
      sellerPhone: user.phone,
      createdAt: product.createdAt,
    })
    .from(product)
    .innerJoin(user, eq(product.sellerId, user.id))
    .leftJoin(category, eq(product.categoryId, category.id))
    .leftJoin(laboratory, eq(product.laboratoryId, laboratory.id))
    .where(whereClause)
    .orderBy(...orderByColumnsSeller)
    .limit(limit)
    .offset(offset)

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(product)
    .innerJoin(user, eq(product.sellerId, user.id))
    .where(whereClause)

  const productIds = productsData.map((p) => p.id)
  const images =
    productIds.length > 0
      ? await db
          .select({
            productId: productImage.productId,
            url: productImage.url,
            sortOrder: productImage.sortOrder,
          })
          .from(productImage)
          .where(inArray(productImage.productId, productIds))
          .orderBy(productImage.sortOrder)
      : []

  const imageByProduct = new Map<string, string>()
  for (const img of images) {
    if (!imageByProduct.has(img.productId)) {
      imageByProduct.set(img.productId, img.url)
    }
  }

  const products: AdminProductRow[] = productsData.map((p) => ({
    id: p.id,
    sku: p.sku,
    title: p.title,
    description: p.description,
    identification: p.identification ?? null,
    price: String(p.price),
    currency: p.currency,
    productType: p.productType,
    categoryId: p.categoryId,
    categoryName: p.categoryName ?? null,
    stoneCut: p.stoneCut,
    metal: p.metal,
    status: p.status,
    laboratoryId: p.laboratoryId,
    moderationStatus: p.moderationStatus,
    isFeatured: p.isFeatured,
    isCollectorPiece: p.isCollectorPiece,
    isPrivilegeAssist: p.isPrivilegeAssist,
    isPromotion: p.isPromotion,
    promotionComparePrice:
      p.promotionComparePrice != null ? String(p.promotionComparePrice) : null,
    sellerId: p.sellerId,
    sellerName: p.sellerName,
    sellerPhone: p.sellerPhone,
    imageUrl: imageByProduct.get(p.id) ?? null,
    createdAt: p.createdAt,
  }))

  const total = countResult[0]?.count ?? 0
  return { products, total }
}

export type ProductChangeLogEntry = {
  id: string
  createdAt: Date
  changeType: "status" | "price"
  oldValue: string
  newValue: string
}

export type ProductForEdit = {
  id: string
  sku: string | null
  title: string
  description: string | null
  identification: string | null
  price: string
  currency: "USD" | "MMK"
  isNegotiable: boolean
  productType: "loose_stone" | "jewellery"
  categoryId: string | null
  stoneCut: "Faceted" | "Cabochon" | null
  metal: "Gold" | "Silver" | "Other" | null
  jewelleryGemstones: JewelleryGemstoneRow[]
  totalWeightGrams: string | null
  weightCarat: string | null
  dimensions: string | null
  color: string | null
  shape: string | null
  origin: string | null
  laboratoryId: string | null
  certReportNumber: string | null
  certReportDate: string | null
  certReportUrl: string | null
  additionalMemos: string | null
  status: "pending" | "active" | "archive" | "sold" | "hidden"
  moderationStatus: "pending" | "approved" | "rejected"
  isFeatured: boolean
  featured: number
  featuredDurationDays: number
  featuredExpiresAt: Date | null
  isCollectorPiece: boolean
  isPrivilegeAssist: boolean
  isPromotion: boolean
  promotionComparePrice: string | null
  sellerId: string
  imageUrls: string[]
  videoUrls: string[]
  /** Newest first; status & price changes from admin saves */
  changeLog: ProductChangeLogEntry[]
  createdAt: Date
  updatedAt: Date
}

export async function getProductById(id: string): Promise<ProductForEdit | null> {
  const [row] = await db
    .select({
      id: product.id,
      sku: product.sku,
      title: product.title,
      description: product.description,
      identification: product.identification,
      price: product.price,
      currency: product.currency,
      isNegotiable: product.isNegotiable,
      productType: product.productType,
      categoryId: product.categoryId,
      stoneCut: product.stoneCut,
      metal: product.metal,
      totalWeightGrams: product.totalWeightGrams,
      weightCarat: product.weightCarat,
      dimensions: product.dimensions,
      color: product.color,
      shape: product.shape,
      origin: product.origin,
      laboratoryId: product.laboratoryId,
      certReportNumber: product.certReportNumber,
      certReportDate: product.certReportDate,
      certReportUrl: product.certReportUrl,
      additionalMemos: product.additionalMemos,
      status: product.status,
      moderationStatus: product.moderationStatus,
      isFeatured: product.isFeatured,
      featured: product.featured,
      featuredDurationDays: product.featuredDurationDays,
      featuredExpiresAt: product.featuredExpiresAt,
      isCollectorPiece: product.isCollectorPiece,
      isPrivilegeAssist: product.isPrivilegeAssist,
      isPromotion: product.isPromotion,
      promotionComparePrice: product.promotionComparePrice,
      sellerId: product.sellerId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    })
    .from(product)
    .where(eq(product.id, id))

  if (!row) return null

  // Sequential queries for Supabase compatibility (avoid Promise.all connection issues)
  const images = await db
    .select({ url: productImage.url })
    .from(productImage)
    .where(eq(productImage.productId, id))
    .orderBy(productImage.sortOrder)
  const videos = await db
    .select({ url: productVideo.url })
    .from(productVideo)
    .where(eq(productVideo.productId, id))
    .orderBy(productVideo.sortOrder)
  const gemstoneRows = await db
    .select({
      categoryId: productJewelleryGemstone.categoryId,
      categoryName: category.name,
      pieceCount: productJewelleryGemstone.pieceCount,
      weightCarat: productJewelleryGemstone.weightCarat,
      dimensions: productJewelleryGemstone.dimensions,
      color: productJewelleryGemstone.color,
      shape: productJewelleryGemstone.shape,
      origin: productJewelleryGemstone.origin,
      cut: productJewelleryGemstone.cut,
      transparency: productJewelleryGemstone.transparency,
      comment: productJewelleryGemstone.comment,
      inclusions: productJewelleryGemstone.inclusions,
    })
    .from(productJewelleryGemstone)
    .innerJoin(category, eq(productJewelleryGemstone.categoryId, category.id))
    .where(eq(productJewelleryGemstone.productId, id))

  const jewelleryGemstones: JewelleryGemstoneRow[] = gemstoneRows.map((g) => ({
    categoryId: g.categoryId,
    categoryName: g.categoryName,
    weightCarat: String(g.weightCarat),
    pieceCount: g.pieceCount ?? null,
    dimensions: g.dimensions ?? null,
    color: g.color ?? null,
    shape: g.shape ?? null,
    origin: g.origin ?? null,
    cut: g.cut ?? null,
    transparency: g.transparency ?? null,
    comment: g.comment ?? null,
    inclusions: g.inclusions ?? null,
  }))

  const logRows = await db
    .select({
      id: productAdminChangeLog.id,
      createdAt: productAdminChangeLog.createdAt,
      changeType: productAdminChangeLog.changeType,
      oldValue: productAdminChangeLog.oldValue,
      newValue: productAdminChangeLog.newValue,
    })
    .from(productAdminChangeLog)
    .where(eq(productAdminChangeLog.productId, id))
    .orderBy(desc(productAdminChangeLog.createdAt))
    .limit(200)

  const changeLog: ProductChangeLogEntry[] = logRows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    changeType: r.changeType,
    oldValue: r.oldValue,
    newValue: r.newValue,
  }))

  return {
    id: row.id,
    sku: row.sku,
    title: row.title,
    description: row.description,
    identification: row.identification ?? null,
    price: String(row.price),
    currency: row.currency,
    isNegotiable: row.isNegotiable,
    productType: row.productType,
    categoryId: row.categoryId,
    stoneCut: row.stoneCut,
    metal: row.metal,
    jewelleryGemstones,
    totalWeightGrams: row.totalWeightGrams ? String(row.totalWeightGrams) : null,
    weightCarat: row.weightCarat ? String(row.weightCarat) : null,
    dimensions: row.dimensions,
    color: row.color,
    shape: row.shape,
    origin: row.origin,
    laboratoryId: row.laboratoryId,
    certReportNumber: row.certReportNumber,
    certReportDate: row.certReportDate ?? null,
    certReportUrl: row.certReportUrl,
    additionalMemos: row.additionalMemos ?? null,
    status: row.status,
    moderationStatus: row.moderationStatus,
    isFeatured: row.isFeatured,
    featured: row.featured,
    featuredDurationDays: row.featuredDurationDays,
    featuredExpiresAt: row.featuredExpiresAt,
    isCollectorPiece: row.isCollectorPiece,
    isPrivilegeAssist: row.isPrivilegeAssist,
    isPromotion: row.isPromotion,
    promotionComparePrice:
      row.promotionComparePrice != null ? String(row.promotionComparePrice) : null,
    sellerId: row.sellerId,
    imageUrls: images.map((i) => i.url),
    videoUrls: videos.map((v) => v.url),
    changeLog,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export type CreateProductInput = ProductCreate & {
  sellerId: string
  categoryId: string
}

/** Generate SKU with category short code prefix, e.g. RUBY-5EE3A8CE04 */
function generateSku(shortCode: string): string {
  const prefix = shortCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "PRD"
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()
  return `${prefix}-${id}`
}

export async function createProductInDb(input: CreateProductInput): Promise<string> {
  const [categoryRow] = await db
    .select({ shortCode: category.shortCode })
    .from(category)
    .where(eq(category.id, input.categoryId))
    .limit(1)
  if (!categoryRow?.shortCode?.trim()) {
    throw new Error("Category short code is required for SKU generation")
  }
  const sku = generateSku(categoryRow.shortCode)

  const values: typeof product.$inferInsert = {
    title: input.title,
    sku,
    description: input.description ?? null,
    identification: input.identification ?? null,
    price: input.price,
    currency: input.currency,
    isNegotiable: input.isNegotiable ?? false,
    productType: input.productType ?? "loose_stone",
    categoryId: input.categoryId,
    stoneCut: input.stoneCut ?? null,
    metal: input.metal ?? null,
    totalWeightGrams: input.totalWeightGrams ?? null,
    weightCarat: input.weightCarat ?? null,
    dimensions: input.dimensions ?? null,
    color: input.color ?? null,
    shape: input.shape ?? null,
    origin: input.origin ?? null,
    laboratoryId: input.laboratoryId ?? null,
    certReportNumber: input.certReportNumber ?? null,
    certReportDate: input.certReportDate ?? null,
    certReportUrl: input.certReportUrl ?? null,
    additionalMemos: input.additionalMemos ?? null,
    status: input.isCollectorPiece === true ? "pending" : (input.status ?? "active"),
    isFeatured: input.isFeatured ?? false,
    featured: input.featured ?? 0,
    featuredDurationDays:
      (input.isFeatured ?? false) ? (input.featureDurationDays ?? 0) : 0,
    featuredExpiresAt:
      (input.isFeatured ?? false) && (input.featureDurationDays ?? 0) > 0
        ? new Date(
            Date.now() + (input.featureDurationDays ?? 0) * 24 * 60 * 60 * 1000
          )
        : null,
    isCollectorPiece: input.isCollectorPiece ?? false,
    isPrivilegeAssist: input.isPrivilegeAssist ?? false,
    isPromotion: input.isPromotion ?? false,
    promotionComparePrice:
      input.promotionComparePrice != null &&
      String(input.promotionComparePrice).trim() !== ""
        ? String(input.promotionComparePrice).trim()
        : null,
    sellerId: input.sellerId,
  }

  const [inserted] = await db
    .insert(product)
    .values(values)
    .returning({ id: product.id })

  const productId = inserted!.id

  const urls = input.imageUrls ?? []
  if (urls.length > 0) {
    await db.insert(productImage).values(
      urls.map((url, i) => ({
        productId,
        url,
        sortOrder: i,
      }))
    )
  }

  const videoUrls = input.videoUrls ?? []
  if (videoUrls.length > 0) {
    await db.insert(productVideo).values(
      videoUrls.map((url, i) => ({
        productId,
        url,
        sortOrder: i,
      }))
    )
  }

  const gemstones = input.jewelleryGemstones ?? []
  if (gemstones.length > 0) {
    await db.insert(productJewelleryGemstone).values(
      gemstones.map((g) => ({
        productId,
        categoryId: g.categoryId,
        pieceCount: g.pieceCount ?? null,
        weightCarat: g.weightCarat,
        dimensions: g.dimensions ?? null,
        color: g.color ?? null,
        shape: (g.shape as (typeof productJewelleryGemstone.$inferInsert)["shape"]) ?? null,
        origin: g.origin ?? null,
        cut: g.cut ?? null,
        transparency: g.transparency ?? null,
        comment: g.comment ?? null,
        inclusions: g.inclusions ?? null,
      }))
    )
  }

  return productId
}

export type UpdateProductInput = {
  title?: string
  sku?: string | null
  description?: string | null
  identification?: ProductIdentification | null
  price?: string
  currency?: "USD" | "MMK"
  isNegotiable?: boolean
  productType?: "loose_stone" | "jewellery"
  categoryId?: string | null
  stoneCut?: "Faceted" | "Cabochon" | null
  metal?: "Gold" | "Silver" | "Other" | null
  jewelleryGemstones?: {
    categoryId: string
    weightCarat: string
    pieceCount?: number | null
    dimensions?: string | null
    color?: string | null
    shape?: string | null
    origin?: string | null
    cut?: string | null
    transparency?: string | null
    comment?: string | null
    inclusions?: string | null
  }[]
  totalWeightGrams?: string | null
  weightCarat?: string | null
  dimensions?: string | null
  color?: string | null
  shape?: string | null
  origin?: string | null
  laboratoryId?: string | null
  certReportNumber?: string | null
  certReportDate?: string | null
  certReportUrl?: string | null
  additionalMemos?: string | null
  status?: "pending" | "active" | "archive" | "sold" | "hidden"
  moderationStatus?: "pending" | "approved" | "rejected"
  isFeatured?: boolean
  featured?: number
  featureDurationDays?: number
  isCollectorPiece?: boolean
  isPrivilegeAssist?: boolean
  isPromotion?: boolean
  promotionComparePrice?: string | null
  imageUrls?: string[]
  videoUrls?: string[]
}

export async function updateProductInDb(
  id: string,
  input: UpdateProductInput,
  opts?: { actorId?: string | null }
): Promise<void> {
  const { imageUrls, videoUrls, jewelleryGemstones, ...rest } = input
  const actorId = opts?.actorId ?? null

  const [currentRow] = await db
    .select({
      status: product.status,
      price: product.price,
      currency: product.currency,
    })
    .from(product)
    .where(eq(product.id, id))

  const updates: Partial<typeof product.$inferInsert> = {}
  if (rest.title !== undefined) updates.title = rest.title
  if (rest.sku !== undefined) {
    updates.sku = rest.sku
  } else {
    const [row] = await db
      .select({ sku: product.sku, categoryId: product.categoryId })
      .from(product)
      .where(eq(product.id, id))
    if (row && !row.sku) {
      const categoryIdToUse = rest.categoryId ?? row.categoryId
      if (categoryIdToUse) {
        const [cat] = await db
          .select({ shortCode: category.shortCode })
          .from(category)
          .where(eq(category.id, categoryIdToUse))
          .limit(1)
        if (cat?.shortCode?.trim()) updates.sku = generateSku(cat.shortCode)
        else updates.sku = generateSku("PRD")
      } else {
        updates.sku = generateSku("PRD")
      }
    }
  }
  if (rest.description !== undefined) updates.description = rest.description
  if (rest.identification !== undefined) updates.identification = rest.identification
  if (rest.price !== undefined) updates.price = rest.price
  if (rest.currency !== undefined) updates.currency = rest.currency
  if (rest.isNegotiable !== undefined) updates.isNegotiable = rest.isNegotiable
  if (rest.productType !== undefined) updates.productType = rest.productType
  if (rest.categoryId !== undefined) updates.categoryId = rest.categoryId
  if (rest.stoneCut !== undefined) updates.stoneCut = rest.stoneCut
  if (rest.metal !== undefined) updates.metal = rest.metal
  if (rest.totalWeightGrams !== undefined) updates.totalWeightGrams = rest.totalWeightGrams
  if (rest.weightCarat !== undefined) updates.weightCarat = rest.weightCarat
  if (rest.dimensions !== undefined) updates.dimensions = rest.dimensions
  if (rest.color !== undefined) updates.color = rest.color
  if (rest.shape !== undefined)
    updates.shape = rest.shape as (typeof product.$inferInsert)["shape"]
  if (rest.origin !== undefined) updates.origin = rest.origin
  if (rest.laboratoryId !== undefined) updates.laboratoryId = rest.laboratoryId
  if (rest.certReportNumber !== undefined)
    updates.certReportNumber = rest.certReportNumber
  if (rest.certReportDate !== undefined) updates.certReportDate = rest.certReportDate
  if (rest.certReportUrl !== undefined) updates.certReportUrl = rest.certReportUrl
  if (rest.additionalMemos !== undefined)
    updates.additionalMemos = rest.additionalMemos
  if (rest.status !== undefined) updates.status = rest.status
  if (rest.moderationStatus !== undefined)
    updates.moderationStatus = rest.moderationStatus
  if (rest.isFeatured !== undefined) updates.isFeatured = rest.isFeatured
  if (rest.featured !== undefined) updates.featured = rest.featured
  if (rest.featureDurationDays !== undefined) {
    const days = Math.min(365, Math.max(0, Math.floor(rest.featureDurationDays) || 0))
    updates.featuredDurationDays = days
    const isFeaturedNext =
      rest.isFeatured ?? updates.isFeatured ?? false
    updates.featuredExpiresAt =
      isFeaturedNext && days > 0
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        : null
  }
  if (rest.isCollectorPiece !== undefined) updates.isCollectorPiece = rest.isCollectorPiece
  if (rest.isPrivilegeAssist !== undefined) updates.isPrivilegeAssist = rest.isPrivilegeAssist
  if (rest.isPromotion !== undefined) updates.isPromotion = rest.isPromotion
  if (rest.promotionComparePrice !== undefined) {
    updates.promotionComparePrice =
      rest.promotionComparePrice != null &&
      String(rest.promotionComparePrice).trim() !== ""
        ? String(rest.promotionComparePrice).trim()
        : null
  }

  const logValues: (typeof productAdminChangeLog.$inferInsert)[] = []
  if (currentRow) {
    if (rest.status !== undefined && rest.status !== currentRow.status) {
      logValues.push({
        productId: id,
        changeType: "status",
        oldValue: currentRow.status,
        newValue: rest.status,
        actorId,
      })
    }
    const nextCurrency =
      rest.currency !== undefined ? rest.currency : currentRow.currency
    const nextPriceStr =
      rest.price !== undefined
        ? String(rest.price).trim()
        : String(currentRow.price)
    const priceTouched =
      rest.price !== undefined || rest.currency !== undefined
    if (priceTouched) {
      const oldLine = formatPriceLineForLog(
        currentRow.currency,
        String(currentRow.price)
      )
      const newLine = formatPriceLineForLog(nextCurrency, nextPriceStr)
      if (oldLine !== newLine) {
        logValues.push({
          productId: id,
          changeType: "price",
          oldValue: oldLine,
          newValue: newLine,
          actorId,
        })
      }
    }
  }

  if (Object.keys(updates).length > 0 || logValues.length > 0) {
    await db.transaction(async (tx) => {
      if (Object.keys(updates).length > 0) {
        await tx.update(product).set(updates).where(eq(product.id, id))
      }
      if (logValues.length > 0) {
        await tx.insert(productAdminChangeLog).values(logValues)
      }
    })
  }

  if (jewelleryGemstones !== undefined) {
    await db.delete(productJewelleryGemstone).where(eq(productJewelleryGemstone.productId, id))
    if (jewelleryGemstones.length > 0) {
      await db.insert(productJewelleryGemstone).values(
        jewelleryGemstones.map((g) => ({
          productId: id,
          categoryId: g.categoryId,
          pieceCount: g.pieceCount ?? null,
          weightCarat: g.weightCarat,
          dimensions: g.dimensions ?? null,
          color: g.color ?? null,
          shape: (g.shape as (typeof productJewelleryGemstone.$inferInsert)["shape"]) ?? null,
          origin: g.origin ?? null,
          cut: g.cut ?? null,
          transparency: g.transparency ?? null,
          comment: g.comment ?? null,
          inclusions: g.inclusions ?? null,
        }))
      )
    }
  }

  if (imageUrls !== undefined) {
    await db.delete(productImage).where(eq(productImage.productId, id))
    if (imageUrls.length > 0) {
      await db.insert(productImage).values(
        imageUrls.map((url, i) => ({
          productId: id,
          url,
          sortOrder: i,
        }))
      )
    }
  }

  if (videoUrls !== undefined) {
    await db.delete(productVideo).where(eq(productVideo.productId, id))
    if (videoUrls.length > 0) {
      await db.insert(productVideo).values(
        videoUrls.map((url: string, i: number) => ({
          productId: id,
          url,
          sortOrder: i,
        }))
      )
    }
  }
}

export async function deleteProductInDb(id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(product)
    .where(eq(product.id, id))
    .returning({ id: product.id })

  return !!deleted
}

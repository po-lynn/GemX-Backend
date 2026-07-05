import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { jsonCached, jsonUncached, jsonError } from "@/lib/api"
import { createProductInDb, getAdminProductsFromDb } from "@/features/products/db/products"
import { revalidateProductsCache } from "@/features/products/db/cache/products"
import { getColorById } from "@/features/colors/db/color"
import { productCreateSchema } from "@/features/products/schemas/products"
import { adminProductsSearchSchema } from "@/features/products/schemas/products"
import type { z } from "zod"
import { normalizeProductBody } from "@/features/products/api/normalize-product-body"
import { deductUserPoints, getUserPointBalance } from "@/features/points/db/points"
import { maskPrice } from "@/lib/formatters"
import { getApprovedCollectorPieceProductIds } from "@/features/collector-piece-show-requests/db/collector-piece-show-requests"
import type { AdminProductRow } from "@/features/products/db/products"

/** Public list JSON: expose DB `featured_expires_at` as snake_case ISO 8601. */
function toPublicProductListItem(p: AdminProductRow) {
  const { featuredExpiresAt, ...rest } = p
  return {
    ...rest,
    featured_expires_at: featuredExpiresAt?.toISOString() ?? null,
  }
}

function maskCollectorPiece(p: { id: string; price: string; currency: string; status: string; imageUrl: string | null; [key: string]: unknown }) {
  return {
    id: p.id,
    sku: null, title: null, description: null, identification: null,
    price: null, maskedPrice: maskPrice(p.price), currency: p.currency,
    productType: null, categoryId: null, categoryName: null,
    stoneCut: null, metal: null,
    status: p.status, moderationStatus: null,
    isFeatured: false, featured_expires_at: null, isCollectorPiece: true,
    isPrivilegeAssist: false, isVerified: false,
    sellerId: null, sellerName: null, sellerPhone: null,
    imageUrl: p.imageUrl, createdAt: null,
  }
}

export async function GET(request: NextRequest) {
  await connection()
  try {
    const { searchParams } = new URL(request.url)
    const parsed = adminProductsSearchSchema.safeParse({
      page: searchParams.get("page") || undefined,
      search: searchParams.get("search") || undefined,
      productType: searchParams.get("productType") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      status: searchParams.get("status") || undefined,
      stoneCut: searchParams.get("stoneCut") || undefined,
      metal: searchParams.get("metal") || undefined,
      identification: searchParams.get("identification") || undefined,
      shape: searchParams.get("shape") || undefined,
      origin: searchParams.get("origin") || undefined,
      laboratoryId: searchParams.get("laboratoryId") || undefined,
      createdFrom: searchParams.get("createdFrom") || undefined,
      createdTo: searchParams.get("createdTo") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      sortOrder: searchParams.get("sortOrder") || undefined,
      isFeatured:
        searchParams.get("isFeatured") ||
        searchParams.get("featured") ||
        undefined,
      isCollectorPiece: searchParams.get("isCollectorPiece") || undefined,
      isPrivilegeAssist: searchParams.get("isPrivilegeAssist") || undefined,
    })
    type SearchParams = z.infer<typeof adminProductsSearchSchema>
    const data: SearchParams = (parsed.success ? parsed.data : { page: 1 }) as SearchParams
    const {
      page = 1,
      search,
      productType,
      categoryId,
      stoneCut,
      metal,
      identification,
      shape,
      origin,
      laboratoryId,
      createdFrom,
      createdTo,
      sortBy,
      sortOrder,
      isFeatured,
      isCollectorPiece,
      isPrivilegeAssist,
    } = data
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100)

    const hasSearch = Boolean(search?.trim())
    /** New-products / “recent” list: pure `createdAt` order (newest first). Ignored when `search` is set so search keeps marketplace + relevance ordering. */
    const newest =
      searchParams.get("newest") === "true" ||
      searchParams.get("newest") === "1"
    /** Admin-style column sort (same as passing sortBy/sortOrder to admin UI). */
    const explicitSort =
      searchParams.has("sortBy") || searchParams.has("sortOrder")

    let sortByPublicPriority: boolean
    let sortByArg: "createdAt" | "title" | "price" | "status" | undefined
    let sortOrderArg: "asc" | "desc" | undefined

    if (hasSearch) {
      // Search + filters: collector → privilege → featured → createdAt (and relevance when searching)
      sortByPublicPriority = true
    } else if (explicitSort) {
      sortByPublicPriority = false
      sortByArg = sortBy ?? "createdAt"
      sortOrderArg = sortOrder ?? "desc"
    } else if (newest) {
      sortByPublicPriority = false
      sortByArg = "createdAt"
      sortOrderArg = "desc"
    } else {
      // Browse with filters only (no search): same marketplace ordering as search
      sortByPublicPriority = true
    }

    const listOpts = {
      page,
      limit,
      search: search ?? undefined,
      productType: productType ?? undefined,
      categoryId: categoryId ?? undefined,
      status: "active" as const,
      excludeModerationStatuses: ["rejected"] as const,
      stoneCut: stoneCut ?? undefined,
      ...(metal ? { metal } : {}),
      ...(identification ? { identification } : {}),
      isFeatured: isFeatured ?? undefined,
      shape: shape ?? undefined,
      origin: origin ?? undefined,
      laboratoryId: laboratoryId ?? undefined,
      createdFrom: createdFrom ?? undefined,
      createdTo: createdTo ?? undefined,
      isCollectorPiece: isCollectorPiece ?? undefined,
      isPrivilegeAssist: isPrivilegeAssist ?? undefined,
      sortByPublicPriority,
      ...(sortByPublicPriority
        ? {}
        : { sortBy: sortByArg!, sortOrder: sortOrderArg! }),
    }

    /** Collector-piece browse: public = all masked; authenticated = approved products show full data, others masked. */
    const collectorPieceFilter = isCollectorPiece === true
    if (collectorPieceFilter) {
      const session = await auth.api.getSession({ headers: request.headers })
      const { products, total } = await getAdminProductsFromDb(listOpts)
      if (session) {
        const approvedIds = await getApprovedCollectorPieceProductIds(session.user.id)
        const result = products.map((p) =>
          approvedIds.has(p.id) ? toPublicProductListItem(p) : maskCollectorPiece(p)
        )
        return jsonUncached({ products: result, total })
      }
      return jsonCached({ products: products.map(maskCollectorPiece), total })
    }

    const { products, total } = await getAdminProductsFromDb(listOpts)
    // Only mask collector pieces in the general browse; skip masking when explicitly filtering for another type
    const maskInBrowse = !isPrivilegeAssist && !isFeatured
    return jsonCached({
      products: products.map((p) =>
        maskInBrowse && p.isCollectorPiece
          ? maskCollectorPiece(p)
          : toPublicProductListItem(p)
      ),
      total,
    })
  } catch (error) {
    console.error("GET /api/products:", error)
    return jsonError("Failed to fetch products", 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return jsonError("Unauthorized", 401)
    }
    const body = await request.json().catch(() => ({}))
    const normalized = normalizeProductBody(body)
    const parsed = productCreateSchema.safeParse(normalized)
    if (!parsed.success) {
      const flat = parsed.error.flatten()
      const msg =
        flat.formErrors.join(", ") ||
        Object.entries(flat.fieldErrors)
          .map(([k, v]) => `${k}: ${(v as string[])?.[0] ?? "invalid"}`)
          .join(", ") ||
        "Invalid input"
      return Response.json(
        { error: msg, details: flat.fieldErrors },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }
    let resolvedColor = parsed.data.color
    if (parsed.data.colorId) {
      const colorRow = await getColorById(parsed.data.colorId)
      if (!colorRow) {
        return jsonError("Unknown colorId", 400)
      }
      resolvedColor = colorRow.name
    }

    const featuredPoints =
      (parsed.data.isFeatured ?? false) ? Math.max(0, parsed.data.featured ?? 0) : 0

    if (featuredPoints > 0) {
      const { available } = await getUserPointBalance(session.user.id)
      if (available < featuredPoints) {
        return jsonError("Insufficient points balance", 400)
      }

      const deduction = await deductUserPoints(session.user.id, featuredPoints)
      if (!deduction.success) {
        return jsonError("Insufficient points balance", 400)
      }
    }

    const createInput = {
      ...parsed.data,
      color: resolvedColor,
      sellerId: session.user.id,
      jewelleryGemstones: Array.isArray(parsed.data.jewelleryGemstones)
        ? parsed.data.jewelleryGemstones
        : [],
    }
    const productId = await createProductInDb(createInput)
    revalidateProductsCache(productId)
    return jsonUncached({ success: true, productId }, { status: 201 })
  } catch (error) {
    console.error("POST /api/products:", error)
    return jsonError("Failed to create product", 500)
  }
}

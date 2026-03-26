import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { jsonCached, jsonUncached, jsonError } from "@/lib/api"
import { createProductInDb } from "@/features/products/db/products"
import {
  getAdminProducts,
  revalidateProductsCache,
} from "@/features/products/db/cache/products"
import { productCreateSchema } from "@/features/products/schemas/products"
import { adminProductsSearchSchema } from "@/features/products/schemas/products"
import type { z } from "zod"
import { normalizeProductBody } from "@/features/products/api/normalize-product-body"

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
      isPromotion:
        searchParams.get("isPromotion") ||
        searchParams.get("promotion") ||
        undefined,
    })
    type SearchParams = z.infer<typeof adminProductsSearchSchema>
    const data: SearchParams = (parsed.success ? parsed.data : { page: 1 }) as SearchParams
    const {
      page = 1,
      search,
      productType,
      categoryId,
      status,
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
      isPromotion,
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
      // Search + filters: collector → privilege → featured → promotion → createdAt (and relevance when searching)
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

    // Public list: only active products (callers can pass ?status= to override)
    const { products, total } = await getAdminProducts({
      page,
      limit,
      search: search ?? undefined,
      productType: productType ?? undefined,
      categoryId: categoryId ?? undefined,
      status: status ?? "active",
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
      isPromotion: isPromotion ?? undefined,
      sortByPublicPriority,
      ...(sortByPublicPriority
        ? {}
        : { sortBy: sortByArg!, sortOrder: sortOrderArg! }),
    })
    return jsonCached({ products, total })
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
    const createInput = {
      ...parsed.data,
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

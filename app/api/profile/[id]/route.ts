import { NextRequest, connection } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { getUserById } from "@/features/users/db/users"
import {
  getPublicProfilePresence,
  type PublicProfilePresence,
} from "@/features/users/db/profile-presence"
import { getProductsBySellerId } from "@/features/products/db/products"
import { adminProductsSearchSchema } from "@/features/products/schemas/products"
import { isUserActivePremiumDealer } from "@/features/points/db/points"
import type { z } from "zod"
import { withQueryTimeout, QueryTimeoutError } from "@/lib/query-timeout"
import { safeAll } from "@/lib/db-timeout"

/** Vercel backstop: if a query hangs past this, the platform kills the invocation instead of it running to the plan default. */
export const maxDuration = 10

/** Client-facing ceiling for the primary DB calls; leaves headroom under maxDuration for auth/session lookups. */
const PROFILE_QUERY_TIMEOUT_MS = 6000

function jsonTimeout(message: string): Response {
  return Response.json(
    { error: message },
    { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3" } }
  )
}

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  await connection()
  try {
    const { id } = await params
    if (!id?.trim()) return jsonError("Profile not found", 404)

    // Primary: the profile itself — nothing useful to return without it.
    const user = await withQueryTimeout(
      getUserById(id),
      PROFILE_QUERY_TIMEOUT_MS,
      "profile-user"
    )
    if (!user || user.archived) return jsonError("Profile not found", 404)

    const { searchParams } = new URL(request.url)
    const parsed = adminProductsSearchSchema.safeParse({
      page: searchParams.get("page") || undefined,
      search: searchParams.get("search") || undefined,
      productType: searchParams.get("productType") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      stoneCut: searchParams.get("stoneCut") || undefined,
      shape: searchParams.get("shape") || undefined,
      origin: searchParams.get("origin") || undefined,
      laboratoryId: searchParams.get("laboratoryId") || undefined,
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
      shape,
      origin,
      laboratoryId,
      isCollectorPiece,
      isPrivilegeAssist,
    } = data
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100)

    // Primary: the seller's product listings are the actual content of a profile page.
    const { products, total } = await withQueryTimeout(
      getProductsBySellerId(id, {
        page,
        limit,
        search: search ?? undefined,
        productType: productType ?? undefined,
        categoryId: categoryId ?? undefined,
        status: "active",
        stoneCut: stoneCut ?? undefined,
        shape: shape ?? undefined,
        origin: origin ?? undefined,
        laboratoryId: laboratoryId ?? undefined,
        isCollectorPiece: isCollectorPiece === true ? true : undefined,
        isPrivilegeAssist: isPrivilegeAssist === true ? true : undefined,
      }),
      PROFILE_QUERY_TIMEOUT_MS,
      "profile-products"
    )

    // Secondary/decorative: online/offline presence and the premium-dealer badge enrich an
    // already-useful profile (products + user fields). Degrade gracefully instead of failing
    // the whole request.
    const [presence, isPremiumDealer] = await safeAll([
      {
        promise: getPublicProfilePresence(id),
        // `status: "Unknown"` keeps this distinguishable from a genuinely offline user
        // (status: "Offline") even though `presence` itself has no third state in its type.
        fallback: {
          presence: "offline",
          status: "Unknown",
          lastSeenAt: null,
        } as PublicProfilePresence,
      },
      {
        // false just hides the premium-dealer badge — not a false claim about anything,
        // so a plain boolean fallback is fine here (no UI change needed).
        promise: isUserActivePremiumDealer(id),
        fallback: false,
      },
    ])

    const profile = {
      id: user.id,
      name: user.name,
      image: user.image,
      username: user.username,
      displayUsername: user.displayUsername,
      createdAt: user.createdAt,
      presence: presence.presence,
      status: presence.status,
      lastSeenAt: presence.lastSeenAt,
      verified: user.verified,
      isPremiumDealer,
    }

    return jsonUncached({
      profile,
      products: { products, total },
    })
  } catch (error) {
    if (error instanceof QueryTimeoutError) {
      console.error("GET /api/profile/[id]: timed out:", error.message)
      return jsonTimeout("Profile is taking longer than usual to load — please retry")
    }
    console.error("GET /api/profile/[id]:", error)
    return jsonError("Failed to fetch public profile", 500)
  }
}


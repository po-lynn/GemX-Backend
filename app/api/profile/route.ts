import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { jsonError, jsonUncached } from "@/lib/api"
import { getUserById } from "@/features/users/db/users"
import { getProductsBySellerId } from "@/features/products/db/products"
import { adminProductsSearchSchema } from "@/features/products/schemas/products"
import { isUserActivePremiumDealer } from "@/features/points/db/points"

const profileUpdateBodySchema = z
  .object({
    name: z.preprocess(
      (v) => (v === null ? undefined : v),
      z.string().trim().min(1).max(120).optional()
    ),
    address: z.union([z.string().trim().max(500), z.null()]).optional(),
    image: z.union([z.string().trim().max(2000), z.null()]).optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.address !== undefined || v.image !== undefined,
    { message: "At least one field is required" }
  )

export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const userId = session.user.id

    const { searchParams } = new URL(request.url)
    const parsed = adminProductsSearchSchema.safeParse({
      page: searchParams.get("page") || undefined,
      search: searchParams.get("search") || undefined,
      productType: searchParams.get("productType") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      status: searchParams.get("status") || undefined,
      stoneCut: searchParams.get("stoneCut") || undefined,
      shape: searchParams.get("shape") || undefined,
      origin: searchParams.get("origin") || undefined,
      laboratoryId: searchParams.get("laboratoryId") || undefined,
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
    } = data
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100)

    const user = await getUserById(userId)
    if (!user) return jsonError("Profile not found", 404)

    const { products, total } = await getProductsBySellerId(userId, {
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
    })
    const isPremiumDealer = await isUserActivePremiumDealer(userId)

    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      username: user.username,
      displayUsername: user.displayUsername,
      nrc: user.nrc,
      address: user.address,
      city: user.city,
      state: user.state,
      country: user.country,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      points: user.points,
      emailVerified: user.emailVerified,
      verified: user.verified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isPremiumDealer,
    }

    return jsonUncached({
      profile,
      products: { products, total },
    })
  } catch (error) {
    console.error("GET /api/profile:", error)
    return jsonError("Failed to fetch profile", 500)
  }
}

/**
 * POST /api/profile
 * Update current user profile (name, address, image URL). Auth required.
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = profileUpdateBodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const data = parsed.data
    const payload: Partial<typeof user.$inferInsert> = {}

    if (data.name !== undefined) payload.name = data.name
    if (data.address !== undefined) {
      payload.address = data.address && data.address.length > 0 ? data.address : null
    }
    if (data.image !== undefined) {
      payload.image = data.image && data.image.length > 0 ? data.image : null
    }

    const [updated] = await db
      .update(user)
      .set(payload)
      .where(eq(user.id, session.user.id))
      .returning({
        id: user.id,
        name: user.name,
        address: user.address,
        image: user.image,
        updatedAt: user.updatedAt,
      })

    if (!updated) return jsonError("Profile not found", 404)

    return jsonUncached({ success: true, profile: updated })
  } catch (error) {
    console.error("POST /api/profile:", error)
    return jsonError("Failed to update profile", 500)
  }
}

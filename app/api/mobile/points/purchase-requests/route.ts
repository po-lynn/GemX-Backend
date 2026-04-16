import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/drizzle/db"
import { pointPurchaseRequest } from "@/drizzle/schema/points-schema"
import { desc, eq } from "drizzle-orm"
import { jsonError, jsonUncached } from "@/lib/api"
import { getPointPurchasePackagesSettings } from "@/features/points/db/points"

const createSchema = z.object({
  packageName: z.string().min(1).max(200),
  /** Currency the customer is paying in — must match a configured price on the package */
  currency: z.enum(["mmk", "usd", "krw"]).default("mmk"),
  /** Amount the customer transferred (in the selected currency) */
  transferredAmount: z.coerce.number().int().min(0),
  /** Name the customer used on the transfer */
  transferredName: z.string().min(1).max(200),
  /** Transaction reference / receipt number from the transfer */
  transactionReference: z.string().min(1).max(200),
  /** Optional extra note */
  transferNote: z.string().max(500).optional(),
})

/**
 * GET /api/mobile/points/purchase-requests
 * Returns the authenticated user's own credit point purchase request history.
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const rows = await db
      .select({
        id: pointPurchaseRequest.id,
        packageName: pointPurchaseRequest.packageName,
        points: pointPurchaseRequest.points,
        price: pointPurchaseRequest.price,
        currency: pointPurchaseRequest.currency,
        status: pointPurchaseRequest.status,
        transferredAmount: pointPurchaseRequest.transferredAmount,
        transferredName: pointPurchaseRequest.transferredName,
        transactionReference: pointPurchaseRequest.transactionReference,
        transferNote: pointPurchaseRequest.transferNote,
        adminNote: pointPurchaseRequest.adminNote,
        createdAt: pointPurchaseRequest.createdAt,
        reviewedAt: pointPurchaseRequest.reviewedAt,
      })
      .from(pointPurchaseRequest)
      .where(eq(pointPurchaseRequest.userId, session.user.id))
      .orderBy(desc(pointPurchaseRequest.createdAt))

    return jsonUncached({
      requests: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
      })),
    })
  } catch (e) {
    console.error("GET /api/mobile/points/purchase-requests:", e)
    return jsonError("Failed to load purchase requests", 500)
  }
}

/**
 * POST /api/mobile/points/purchase-requests
 * Submit a credit point purchase request after transferring payment via a configured payment method.
 * Creates a pending request that an admin must approve before points are credited.
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const { packageName, currency, transferredAmount, transferredName, transactionReference, transferNote } = parsed.data

    const settings = await getPointPurchasePackagesSettings()
    const pkg = settings.packages.find((p) => p.name === packageName)
    if (!pkg) return jsonError("Package not found", 400)

    const priceMap: Record<string, number | null | undefined> = {
      mmk: pkg.priceMmk,
      usd: pkg.priceUsd,
      krw: pkg.priceKrw,
    }
    const price = priceMap[currency]
    if (price == null) {
      return jsonError(`Package does not have a price set for ${currency.toUpperCase()}`, 400)
    }

    const [row] = await db
      .insert(pointPurchaseRequest)
      .values({
        userId: session.user.id,
        packageName: pkg.name,
        points: pkg.points,
        price,
        currency,
        status: "pending",
        transferredAmount,
        transferredName,
        transactionReference,
        transferNote: transferNote ?? null,
      })
      .returning({
        id: pointPurchaseRequest.id,
        status: pointPurchaseRequest.status,
        createdAt: pointPurchaseRequest.createdAt,
      })

    return jsonUncached({
      success: true,
      requestId: row.id,
      packageName: pkg.name,
      points: pkg.points,
      price,
      currency,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })
  } catch (e) {
    console.error("POST /api/mobile/points/purchase-requests:", e)
    return jsonError("Failed to submit purchase request", 500)
  }
}

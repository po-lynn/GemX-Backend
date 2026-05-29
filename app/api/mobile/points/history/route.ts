import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import { getUserPointBalance, getUserPointHistory } from "@/features/points/db/points"

const querySchema = z.object({
  filter: z.enum(["all", "topups", "spent", "pending"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/**
 * GET /api/mobile/points/history
 * Returns the authenticated user's point transaction history with optional filter.
 * Query params: filter=all|topups|spent|pending, page=1, limit=20
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      filter: searchParams.get("filter") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    })
    if (!parsed.success) return jsonError("Invalid query params", 400)

    const { filter, page, limit } = parsed.data

    const [balance, { transactions, total }] = await Promise.all([
      getUserPointBalance(session.user.id),
      getUserPointHistory(session.user.id, { filter, page, limit }),
    ])

    return jsonUncached({
      balance,
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        direction: t.direction,
        amount: t.amount,
        status: t.status,
        description: t.description,
        paymentMethod: t.paymentMethod,
        referenceId: t.referenceId,
        referenceType: t.referenceType,
        createdAt: t.createdAt.toISOString(),
      })),
      pagination: { total, page, limit },
    })
  } catch (e) {
    console.error("GET /api/mobile/points/history:", e)
    return jsonError("Failed to load point history", 500)
  }
}

import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import { getUserPointBalance, getUserPointHistory } from "@/features/points/db/points"
import { withQueryTimeout, QueryTimeoutError } from "@/lib/query-timeout"

/** Vercel backstop: if a query hangs past this, the platform kills the invocation instead of it running to the plan default. */
export const maxDuration = 10

/** Client-facing ceiling for each DB call; leaves headroom under maxDuration for auth/session lookups. */
const POINTS_HISTORY_QUERY_TIMEOUT_MS = 6000

function jsonTimeout(message: string): Response {
  return Response.json(
    { error: message },
    { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3" } }
  )
}

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

    // Sequential, not Promise.all: both the balance and the transaction list are primary for
    // this wallet screen (a history list without a balance, or vice versa, is misleading) — each
    // await releases its pooler connection before the next query opens one instead of holding
    // two at once, same pattern as app/api/news/route.ts.
    const balance = await withQueryTimeout(
      getUserPointBalance(session.user.id),
      POINTS_HISTORY_QUERY_TIMEOUT_MS,
      "points-history-balance"
    )
    const { transactions, total } = await withQueryTimeout(
      getUserPointHistory(session.user.id, { filter, page, limit }),
      POINTS_HISTORY_QUERY_TIMEOUT_MS,
      "points-history-transactions"
    )

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
    if (e instanceof QueryTimeoutError) {
      console.error("GET /api/mobile/points/history: timed out:", e.message)
      return jsonTimeout("Point history is taking longer than usual — please retry")
    }
    console.error("GET /api/mobile/points/history:", e)
    return jsonError("Failed to load point history", 500)
  }
}

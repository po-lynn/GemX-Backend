import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { collectorPieceShowRequest } from "@/drizzle/schema/collector-piece-show-request-schema"
import { product } from "@/drizzle/schema/product-schema"
import { and, desc, eq, sql } from "drizzle-orm"

export type CollectorPieceShowRequestRow = {
  id: string
  userId: string
  productId: string
  message: string | null
  status: string
  createdAt: Date
  requester: {
    name: string
    phone: string | null
    email: string
  }
  product: {
    title: string
    status: string
  }
}

export async function getCollectorPieceShowRequestsPaginated(options: {
  page: number
  limit: number
  status?: "pending" | "approved" | "rejected"
}): Promise<{ requests: CollectorPieceShowRequestRow[]; total: number }> {
  const { page, limit, status } = options
  const whereClause = status ? and(eq(collectorPieceShowRequest.status, status)) : undefined

  const rows = await db
    .select({
      id: collectorPieceShowRequest.id,
      userId: collectorPieceShowRequest.userId,
      productId: collectorPieceShowRequest.productId,
      message: collectorPieceShowRequest.message,
      status: collectorPieceShowRequest.status,
      createdAt: collectorPieceShowRequest.createdAt,
      requesterName: user.name,
      requesterPhone: user.phone,
      requesterEmail: user.email,
      productTitle: product.title,
      productStatus: product.status,
    })
    .from(collectorPieceShowRequest)
    .innerJoin(user, eq(user.id, collectorPieceShowRequest.userId))
    .innerJoin(product, eq(product.id, collectorPieceShowRequest.productId))
    .where(whereClause)
    .orderBy(desc(collectorPieceShowRequest.createdAt))
    .limit(limit)
    .offset((page - 1) * limit)

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collectorPieceShowRequest)
    .where(whereClause)

  return {
    requests: rows.map((r) => {
      return {
        id: r.id,
        userId: r.userId,
        productId: r.productId,
        message: r.message,
        status: r.status,
        createdAt: r.createdAt,
        requester: {
          name: r.requesterName,
          phone: r.requesterPhone,
          email: r.requesterEmail,
        },
        product: {
          title: r.productTitle,
          status: r.productStatus,
        },
      }
    }),
    total: countRows[0]?.count ?? 0,
  }
}

export async function approveCollectorPieceShowRequestInDb(id: string): Promise<{
  ok: true
  requestId: string
  userId: string
  productId: string
  productTitle: string
  alreadyProcessed?: boolean
} | {
  ok: false
  error: "not_found"
}> {
  const [existing] = await db
    .select({
      id: collectorPieceShowRequest.id,
      userId: collectorPieceShowRequest.userId,
      productId: collectorPieceShowRequest.productId,
      status: collectorPieceShowRequest.status,
      productTitle: product.title,
    })
    .from(collectorPieceShowRequest)
    .innerJoin(product, eq(product.id, collectorPieceShowRequest.productId))
    .where(eq(collectorPieceShowRequest.id, id))
    .limit(1)

  if (!existing) return { ok: false, error: "not_found" }
  if (existing.status !== "pending") {
    return {
      ok: true,
      requestId: existing.id,
      userId: existing.userId,
      productId: existing.productId,
      productTitle: existing.productTitle,
      alreadyProcessed: true,
    }
  }

  const [updated] = await db
    .update(collectorPieceShowRequest)
    .set({ status: "approved" })
    .where(and(eq(collectorPieceShowRequest.id, id), eq(collectorPieceShowRequest.status, "pending")))
    .returning({
      id: collectorPieceShowRequest.id,
      userId: collectorPieceShowRequest.userId,
      productId: collectorPieceShowRequest.productId,
      status: collectorPieceShowRequest.status,
    })

  if (!updated) {
    return {
      ok: true,
      requestId: existing.id,
      userId: existing.userId,
      productId: existing.productId,
      productTitle: existing.productTitle,
      alreadyProcessed: true,
    }
  }

  return {
    ok: true,
    requestId: updated.id,
    userId: updated.userId,
    productId: updated.productId,
    productTitle: existing.productTitle,
  }
}

/**
 * Returns the set of productIds that the given user has an approved
 * collector_piece_show_request for. Used to selectively unmask products in lists.
 */
export async function getApprovedCollectorPieceProductIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ productId: collectorPieceShowRequest.productId })
    .from(collectorPieceShowRequest)
    .where(
      and(
        eq(collectorPieceShowRequest.userId, userId),
        eq(collectorPieceShowRequest.status, "approved"),
      ),
    )
  return new Set(rows.map((r) => r.productId))
}

/**
 * Returns the most recent collector_piece_show_request for a given
 * (userId, productId) pair, or null if none exists.
 */
export async function getCollectorPieceShowRequestForUser(
  userId: string,
  productId: string,
): Promise<{ id: string; status: string; createdAt: Date } | null> {
  const [row] = await db
    .select({
      id: collectorPieceShowRequest.id,
      status: collectorPieceShowRequest.status,
      createdAt: collectorPieceShowRequest.createdAt,
    })
    .from(collectorPieceShowRequest)
    .where(
      and(
        eq(collectorPieceShowRequest.userId, userId),
        eq(collectorPieceShowRequest.productId, productId),
      ),
    )
    .orderBy(desc(collectorPieceShowRequest.createdAt))
    .limit(1)
  return row ?? null
}

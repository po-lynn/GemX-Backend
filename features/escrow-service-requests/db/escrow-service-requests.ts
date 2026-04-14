import { and, asc, desc, eq, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { escrowServiceRequest } from "@/drizzle/schema/escrow-service-request-schema"
import { product } from "@/drizzle/schema/product-schema"

const sellerUser = alias(user, "seller_user")

export type EscrowServiceRequestRow = {
  id: string
  userId: string
  type: string
  productId: string | null
  sellerId: string | null
  packageName: string | null
  message: string | null
  status: string
  adminNote: string | null
  createdAt: Date
  updatedAt: Date
  requester: {
    name: string
    email: string
    phone: string | null
  }
  seller: {
    name: string
    email: string | null
    phone: string | null
  } | null
  product: {
    title: string
  } | null
}

export const SORT_COLUMNS = ["created", "status", "type"] as const
export type SortColumn = (typeof SORT_COLUMNS)[number]
export type SortOrder = "asc" | "desc"

export async function getEscrowServiceRequestsPaginated(options: {
  page: number
  limit: number
  status?: string
  type?: string
  sortBy?: SortColumn
  order?: SortOrder
}): Promise<{ requests: EscrowServiceRequestRow[]; total: number }> {
  const { page, limit, status, type, sortBy = "created", order = "desc" } = options

  const whereClause = and(
    status ? eq(escrowServiceRequest.status, status) : undefined,
    type ? eq(escrowServiceRequest.type, type) : undefined,
  )

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: escrowServiceRequest.id,
        userId: escrowServiceRequest.userId,
        type: escrowServiceRequest.type,
        productId: escrowServiceRequest.productId,
        sellerId: escrowServiceRequest.sellerId,
        packageName: escrowServiceRequest.packageName,
        message: escrowServiceRequest.message,
        status: escrowServiceRequest.status,
        adminNote: escrowServiceRequest.adminNote,
        createdAt: escrowServiceRequest.createdAt,
        updatedAt: escrowServiceRequest.updatedAt,
        requesterName: user.name,
        requesterEmail: user.email,
        requesterPhone: user.phone,
        sellerName: sellerUser.name,
        sellerEmail: sellerUser.email,
        sellerPhone: sellerUser.phone,
        productTitle: product.title,
      })
      .from(escrowServiceRequest)
      .innerJoin(user, eq(user.id, escrowServiceRequest.userId))
      .leftJoin(sellerUser, eq(sellerUser.id, escrowServiceRequest.sellerId))
      .leftJoin(product, eq(product.id, escrowServiceRequest.productId))
      .where(whereClause)
      .orderBy(
        (() => {
          const col =
            sortBy === "status"
              ? escrowServiceRequest.status
              : sortBy === "type"
                ? escrowServiceRequest.type
                : escrowServiceRequest.createdAt
          return order === "asc" ? asc(col) : desc(col)
        })(),
      )
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(escrowServiceRequest)
      .where(whereClause),
  ])

  return {
    requests: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      type: r.type,
      productId: r.productId,
      sellerId: r.sellerId,
      packageName: r.packageName,
      message: r.message,
      status: r.status,
      adminNote: r.adminNote,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      requester: {
        name: r.requesterName,
        email: r.requesterEmail,
        phone: r.requesterPhone,
      },
      seller: r.sellerName
        ? { name: r.sellerName, email: r.sellerEmail, phone: r.sellerPhone }
        : null,
      product: r.productTitle ? { title: r.productTitle } : null,
    })),
    total: countRows[0]?.count ?? 0,
  }
}

export async function updateEscrowServiceRequestStatusInDb(
  id: string,
  status: string,
  adminNote?: string,
): Promise<{ ok: true; requestId: string } | { ok: false; error: "not_found" }> {
  const [updated] = await db
    .update(escrowServiceRequest)
    .set({
      status,
      adminNote: adminNote !== undefined ? adminNote : undefined,
      updatedAt: new Date(),
    })
    .where(eq(escrowServiceRequest.id, id))
    .returning({ id: escrowServiceRequest.id })

  if (!updated) return { ok: false, error: "not_found" }
  return { ok: true, requestId: updated.id }
}

/** DB row shape selected for mobile purchase-request list endpoints */
export type PointPurchaseRequestRow = {
  id: string
  packageName: string
  points: number
  price: number
  currency: string
  status: string
  transferredAmount: number | null
  transferredName: string | null
  transactionReference: string | null
  transferNote: string | null
  adminNote: string | null
  createdAt: Date
  reviewedAt: Date | null
}

/** Mobile JSON uses snake_case `package_name` (maps from DB `package_name` column). */
export function serializePointPurchaseRequest(row: PointPurchaseRequestRow) {
  return {
    id: row.id,
    package_name: row.packageName,
    points: row.points,
    price: row.price,
    currency: row.currency,
    status: row.status,
    transferredAmount: row.transferredAmount,
    transferredName: row.transferredName,
    transactionReference: row.transactionReference,
    transferNote: row.transferNote,
    adminNote: row.adminNote,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  }
}

/** Accept `package_name` or legacy `packageName` in POST body before Zod parse. */
export function normalizePurchaseRequestBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body
  const b = body as Record<string, unknown>
  if (b.package_name == null && b.packageName != null) {
    return { ...b, package_name: b.packageName }
  }
  return body
}

/** DB row shape selected for mobile purchase-request list endpoints */
export type PointPurchaseRequestRow = {
  id: string
  packageName: string
  paymentMethod: string | null
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
    payment_method: row.paymentMethod,
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

/** Accept snake_case or legacy camelCase keys in POST body before Zod parse. */
export function normalizePurchaseRequestBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body
  const b = body as Record<string, unknown>
  const next = { ...b }
  if (next.package_name == null && next.packageName != null) {
    next.package_name = next.packageName
  }
  if (next.payment_method == null && next.paymentMethod != null) {
    next.payment_method = next.paymentMethod
  }
  return next
}

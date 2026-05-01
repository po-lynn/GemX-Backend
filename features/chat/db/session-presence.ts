import { and, gt, inArray, max } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { session } from "@/drizzle/schema/auth-schema"

/**
 * Latest `session.updated_at` per user among sessions that are still valid.
 * Used by admin chat as a proxy for "recently active" / online-ish status.
 */
export async function getLastSessionActivityByUserIds(
  userIds: string[]
): Promise<Map<string, Date>> {
  if (userIds.length === 0) return new Map()

  const now = new Date()
  const rows = await db
    .select({
      userId: session.userId,
      lastAt: max(session.updatedAt),
    })
    .from(session)
    .where(and(inArray(session.userId, userIds), gt(session.expiresAt, now)))
    .groupBy(session.userId)

  const map = new Map<string, Date>()
  for (const r of rows) {
    const d = r.lastAt
    if (d instanceof Date && !Number.isNaN(d.getTime())) {
      map.set(r.userId, d)
    }
  }
  return map
}

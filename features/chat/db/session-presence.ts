import { and, gt, inArray, max, sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { session } from "@/drizzle/schema/auth-schema"

/** Session touched within this window ⇒ "online" (Better Auth `session.updated_at`, Postgres/Supabase). */
export const SESSION_PRESENCE_ONLINE_WINDOW_MS = 5 * 60 * 1000

/** Postgres-js with `fetch_types: false` often returns timestamps as strings; Drizzle `max()` may not be a Date. */
function asSessionTouchDate(value: unknown): Date | null {
  if (value == null) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

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
    const d = asSessionTouchDate(r.lastAt)
    if (d) map.set(r.userId, d)
  }
  return map
}

/**
 * Latest `session.updated_at` per user across all sessions (including expired).
 * Used for "Last seen …" when the user no longer has a valid session row in the online window.
 */
export async function getLastSessionTouchAnyExpiryByUserIds(
  userIds: string[]
): Promise<Map<string, Date>> {
  if (userIds.length === 0) return new Map()

  const rows = await db
    .select({
      userId: session.userId,
      lastAt: max(session.updatedAt),
    })
    .from(session)
    .where(inArray(session.userId, userIds))
    .groupBy(session.userId)

  const map = new Map<string, Date>()
  for (const r of rows) {
    const d = asSessionTouchDate(r.lastAt)
    if (d) map.set(r.userId, d)
  }
  return map
}

/**
 * Single-query replacement for calling both presence functions separately.
 * Returns activeMap (non-expired sessions) and touchMap (all sessions) in one round-trip.
 */
export async function getPresenceMapsForUserIds(
  userIds: string[]
): Promise<{ activeMap: Map<string, Date>; touchMap: Map<string, Date> }> {
  const empty = { activeMap: new Map<string, Date>(), touchMap: new Map<string, Date>() }
  if (userIds.length === 0) return empty

  const rows = await db
    .select({
      userId: session.userId,
      activeLast: sql<unknown>`max(${session.updatedAt}) FILTER (WHERE ${session.expiresAt} > now())`,
      anyLast: max(session.updatedAt),
    })
    .from(session)
    .where(inArray(session.userId, userIds))
    .groupBy(session.userId)

  const activeMap = new Map<string, Date>()
  const touchMap = new Map<string, Date>()

  for (const r of rows) {
    const active = asSessionTouchDate(r.activeLast)
    if (active) activeMap.set(r.userId, active)
    const any = asSessionTouchDate(r.anyLast)
    if (any) touchMap.set(r.userId, any)
  }

  return { activeMap, touchMap }
}

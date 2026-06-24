import {
  SESSION_PRESENCE_ONLINE_WINDOW_MS,
  getPresenceMapsForUserIds,
} from "@/features/chat/db/session-presence"
import { formatRelativeLastSeenPast } from "@/lib/formatters"

export type PublicProfilePresence = {
  /** Derived from Better Auth `session` rows (Postgres on Supabase), same source as admin chat presence. */
  presence: "online" | "offline"
  /** Human-readable status, e.g. `"Online"` or `"Last seen 2 hours ago"`. */
  status: string
  /** Most recent `session.updated_at` for this user (any session), ISO 8601; `null` if they have never had a session row. */
  lastSeenAt: string | null
}

function resolvePresenceFromMaps(
  userId: string,
  activeMap: Map<string, Date>,
  touchMap: Map<string, Date>
): PublicProfilePresence {
  const activeLast = activeMap.get(userId) ?? null
  const anyLast = touchMap.get(userId) ?? null

  const online =
    activeLast !== null &&
    Date.now() - activeLast.getTime() < SESSION_PRESENCE_ONLINE_WINDOW_MS

  const lastSeenAt = anyLast?.toISOString() ?? null

  if (online) {
    return { presence: "online", status: "Online", lastSeenAt }
  }
  if (anyLast) {
    return {
      presence: "offline",
      status: `Last seen ${formatRelativeLastSeenPast(anyLast)}`,
      lastSeenAt,
    }
  }
  return { presence: "offline", status: "Offline", lastSeenAt: null }
}

/** Batch presence for many users (two DB queries total). */
export async function getPublicProfilePresenceMap(
  userIds: string[]
): Promise<Map<string, PublicProfilePresence>> {
  const unique = [...new Set(userIds)].filter(Boolean)
  const out = new Map<string, PublicProfilePresence>()
  if (unique.length === 0) return out

  const { activeMap, touchMap } = await getPresenceMapsForUserIds(unique)

  for (const userId of unique) {
    out.set(userId, resolvePresenceFromMaps(userId, activeMap, touchMap))
  }
  return out
}

export async function getPublicProfilePresence(
  userId: string
): Promise<PublicProfilePresence> {
  const m = await getPublicProfilePresenceMap([userId])
  return (
    m.get(userId) ?? {
      presence: "offline",
      status: "Offline",
      lastSeenAt: null,
    }
  )
}

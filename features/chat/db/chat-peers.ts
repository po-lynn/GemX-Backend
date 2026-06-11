import { asc, eq, inArray } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { messages } from "@/drizzle/schema/chat-schema"

/** Distinct user ids that have at least one `messages` row with `userId`. */
async function getDistinctChatPeerIdsForUser(userId: string): Promise<string[]> {
  const inbound = await db
    .select({ id: messages.senderId })
    .from(messages)
    .where(eq(messages.recipientId, userId))
    .groupBy(messages.senderId)
  const outbound = await db
    .select({ id: messages.recipientId })
    .from(messages)
    .where(eq(messages.senderId, userId))
    .groupBy(messages.recipientId)
  const set = new Set<string>()
  for (const r of inbound) set.add(r.id)
  for (const r of outbound) set.add(r.id)
  return [...set]
}

/** Profiles for chat peers (users who share at least one message with `userId`). */
export async function getChatPeerProfilesForUser(userId: string): Promise<
  { id: string; name: string; role: string; image: string | null }[]
> {
  const ids = await getDistinctChatPeerIdsForUser(userId)
  if (ids.length === 0) return []
  return db
    .select({
      id: user.id,
      name: user.name,
      role: user.role,
      image: user.image,
    })
    .from(user)
    .where(inArray(user.id, ids))
    .orderBy(asc(user.name))
}

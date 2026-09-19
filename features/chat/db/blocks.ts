// Self-service block/unblock (chat-block-schema.ts) — separate from the admin-issued
// mute/ban in features/chat-moderation/db/restrictions.ts. Enforcement checks both
// directions: once either party blocks the other, sends stop and the thread drops out
// of both conversation lists, even though only the blocker's row exists.

import { and, desc, eq, or } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { chatBlock } from "@/drizzle/schema/chat-block-schema"
import { user } from "@/drizzle/schema/auth-schema"

export async function blockUser(blockerId: string, blockedId: string, reason?: string): Promise<void> {
  await db
    .insert(chatBlock)
    .values({ blockerId, blockedId, reason: reason ?? null })
    .onConflictDoNothing()
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  const deleted = await db
    .delete(chatBlock)
    .where(and(eq(chatBlock.blockerId, blockerId), eq(chatBlock.blockedId, blockedId)))
    .returning({ blockerId: chatBlock.blockerId })
  return deleted.length > 0
}

/** The one check the send paths (and conversation-list filters) call. */
export async function isBlockedEitherDirection(userA: string, userB: string): Promise<boolean> {
  const [row] = await db
    .select({ blockerId: chatBlock.blockerId })
    .from(chatBlock)
    .where(
      or(
        and(eq(chatBlock.blockerId, userA), eq(chatBlock.blockedId, userB)),
        and(eq(chatBlock.blockerId, userB), eq(chatBlock.blockedId, userA))
      )
    )
    .limit(1)
  return !!row
}

/**
 * Every user id that is blocked in EITHER direction relative to `userId`, restricted to
 * `candidateIds` — used by the conversation list to filter blocked peers out of both
 * the active-conversations feed and the unread-preview feed in one query.
 */
export async function getBlockedPeerIds(userId: string, candidateIds: string[]): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set()

  const rows = await db
    .select({ blockerId: chatBlock.blockerId, blockedId: chatBlock.blockedId })
    .from(chatBlock)
    .where(or(eq(chatBlock.blockerId, userId), eq(chatBlock.blockedId, userId)))

  const blocked = new Set<string>()
  const candidates = new Set(candidateIds)
  for (const row of rows) {
    const peerId = row.blockerId === userId ? row.blockedId : row.blockerId
    if (candidates.has(peerId)) blocked.add(peerId)
  }
  return blocked
}

export type BlockedUserItem = {
  userId: string
  name: string | null
  image: string | null
  reason: string | null
  createdAt: string
}

export async function listBlockedUsers(blockerId: string): Promise<BlockedUserItem[]> {
  const rows = await db
    .select({
      userId: chatBlock.blockedId,
      name: user.name,
      image: user.image,
      reason: chatBlock.reason,
      createdAt: chatBlock.createdAt,
    })
    .from(chatBlock)
    .innerJoin(user, eq(user.id, chatBlock.blockedId))
    .where(eq(chatBlock.blockerId, blockerId))
    .orderBy(desc(chatBlock.createdAt))

  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
}

import { db } from "@/drizzle/db";
import { userActiveChatView } from "@/drizzle/schema/chat-active-view-schema";
import { getDirectConversationId } from "@/features/chat/lib/conversation-id";
import { eq } from "drizzle-orm";

/** Heartbeat older than this is treated as "not viewing" (mobile should refresh every ~30s). */
export const ACTIVE_CHAT_VIEW_TTL_MS = 90_000;

export async function setActiveChatView(userId: string, peerId: string): Promise<void> {
  const conversationId = getDirectConversationId(userId, peerId);
  const now = new Date();
  await db
    .insert(userActiveChatView)
    .values({
      userId,
      peerId,
      conversationId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userActiveChatView.userId,
      set: {
        peerId,
        conversationId,
        updatedAt: now,
      },
    });
}

export async function clearActiveChatView(userId: string): Promise<void> {
  await db.delete(userActiveChatView).where(eq(userActiveChatView.userId, userId));
}

/**
 * True when the user is actively viewing a 1:1 chat with `peerId` (recent heartbeat).
 */
export async function isUserViewingPeer(userId: string, peerId: string): Promise<boolean> {
  const [row] = await db
    .select({
      peerId: userActiveChatView.peerId,
      updatedAt: userActiveChatView.updatedAt,
    })
    .from(userActiveChatView)
    .where(eq(userActiveChatView.userId, userId))
    .limit(1);

  if (!row || row.peerId !== peerId) return false;

  const ageMs = Date.now() - row.updatedAt.getTime();
  return ageMs <= ACTIVE_CHAT_VIEW_TTL_MS;
}

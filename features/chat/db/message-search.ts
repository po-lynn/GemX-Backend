// Full-text search over the current user's own flat-chat history. Scoped to flat chat
// only — escrow-case threads have no buyer/seller-facing surface today (see
// features/escrow-cases/lib/case-access.ts), so there's nothing for an end user to
// search there. Uses the same to_tsvector/plainto_tsquery pattern as product search
// (features/products/db/products.ts), backed by messages_content_fts_idx
// (0102_chat_message_search_index.sql).

import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { messages } from "@/drizzle/schema/chat-schema";

export type ChatMessageSearchResult = {
  id: string;
  peerId: string;
  peerName: string | null;
  peerImage: string | null;
  content: string;
  messageType: string;
  createdAt: string;
};

export async function searchChatMessages(
  currentUserId: string,
  query: string,
  options: { peerId?: string; page: number; limit: number }
): Promise<{ results: ChatMessageSearchResult[]; total: number }> {
  const { peerId, page, limit } = options;
  const offset = (page - 1) * limit;

  const participantClause = peerId
    ? or(
        and(eq(messages.senderId, currentUserId), eq(messages.recipientId, peerId)),
        and(eq(messages.senderId, peerId), eq(messages.recipientId, currentUserId))
      )
    : or(eq(messages.senderId, currentUserId), eq(messages.recipientId, currentUserId));

  const matchClause = sql`to_tsvector('english', coalesce(${messages.content}, '')) @@ plainto_tsquery('english', ${query})`;
  const whereClause = and(participantClause, matchClause);

  // count(*) OVER() gets the page and the total match count in ONE round trip instead of
  // two — this FTS query is the most expensive one in the chat backend (see
  // docs/technical/chat-message-search.md), so halving its cost matters. Trade-off: if
  // `page` is requested past the last page, OFFSET removes every row before the window
  // function's count can be read back, so an over-paginated request reports total: 0
  // instead of the true count. Acceptable here — `total` exists to drive "is there a next
  // page," not to be authoritative for a page number nobody should be requesting anyway.
  const rows = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      content: messages.content,
      messageType: messages.messageType,
      createdAt: messages.createdAt,
      total: sql<number>`count(*) over()::int`,
    })
    .from(messages)
    .where(whereClause)
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .offset(offset);

  if (rows.length === 0) return { results: [], total: 0 };

  const peerIds = [
    ...new Set(rows.map((r) => (r.senderId === currentUserId ? r.recipientId : r.senderId))),
  ];
  const profiles = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(
      peerIds.length === 1 ? eq(user.id, peerIds[0]!) : or(...peerIds.map((id) => eq(user.id, id)))
    );
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const results: ChatMessageSearchResult[] = rows.map((r) => {
    const resolvedPeerId = r.senderId === currentUserId ? r.recipientId : r.senderId;
    const profile = profileById.get(resolvedPeerId);
    return {
      id: r.id,
      peerId: resolvedPeerId,
      peerName: profile?.name ?? null,
      peerImage: profile?.image ?? null,
      content: r.content,
      messageType: r.messageType,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return { results, total: rows[0]!.total };
}

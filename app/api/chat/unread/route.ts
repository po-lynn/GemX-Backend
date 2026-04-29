import { NextRequest, connection } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { messages } from "@/drizzle/schema/chat-schema";
import { jsonError, jsonUncached } from "@/lib/api";

/**
 * GET /api/chat/unread
 * Returns unread incoming counts grouped by sender (conversation peer).
 */
export async function GET(_request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: _request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const currentUserId = session.user.id;

    const rows = await db
      .select({
        senderId: messages.senderId,
        unread: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(and(eq(messages.recipientId, currentUserId), eq(messages.isRead, false)))
      .groupBy(messages.senderId);

    const byPeer: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      const n = row.unread ?? 0;
      byPeer[row.senderId] = n;
      total += n;
    }

    return jsonUncached({ success: true, byPeer, total });
  } catch (error) {
    console.error("GET /api/chat/unread:", error);
    return jsonError("Failed to load unread counts", 500);
  }
}

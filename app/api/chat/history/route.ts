import { NextRequest, connection } from "next/server";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { messages } from "@/drizzle/schema/chat-schema";
import { jsonError, jsonUncached, parseQuery } from "@/lib/api";
import { withQueryTimeout, QueryTimeoutError } from "@/lib/query-timeout";
import { withTimeout } from "@/lib/db-timeout";

const querySchema = z.object({
  userId: z.string().trim().min(1),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/** Vercel backstop: if a query hangs past this, the platform kills the invocation instead of it running to the plan default. */
export const maxDuration = 10;

/** Client-facing ceiling for the primary queries; leaves headroom under maxDuration for auth/session lookups. */
const CHAT_HISTORY_QUERY_TIMEOUT_MS = 6000;
/** Short ceiling for the decorative peer-avatar lookup — never worth holding up the whole response for. */
const CHAT_HISTORY_PEER_IMAGE_TIMEOUT_MS = 3000;

function jsonTimeout(message: string): Response {
  return Response.json(
    { error: message },
    { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3" } }
  );
}

/**
 * GET /api/chat/history?userId=<otherUserId>&page=1&limit=30
 * Authenticated conversation history between current user and userId.
 */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const { userId, page, limit } = parseQuery(new URL(request.url).searchParams, querySchema);
    const currentUserId = session.user.id;
    const offset = (page - 1) * limit;

    const whereClause = or(
      and(eq(messages.senderId, currentUserId), eq(messages.recipientId, userId)),
      and(eq(messages.senderId, userId), eq(messages.recipientId, currentUserId))
    );

    // Messages page and total count are both primary — the screen has nothing useful to
    // show without the messages, and an inaccurate/missing total breaks pagination. Run
    // them sequentially (not Promise.all) so the request never holds two pooler
    // connections at once, and let a timeout on either one fail loud with a retryable 503.
    const rows = await withQueryTimeout(
      db
        .select({
          id: messages.id,
          senderId: messages.senderId,
          recipientId: messages.recipientId,
          content: messages.content,
          fileUrl: messages.fileUrl,
          imageUrls: messages.imageUrls,
          messageType: messages.messageType,
          isRead: messages.isRead,
          starred: messages.starred,
          editedAt: messages.editedAt,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(whereClause)
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset),
      CHAT_HISTORY_QUERY_TIMEOUT_MS,
      "chat-history-messages"
    );
    const countRows = await withQueryTimeout(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(whereClause),
      CHAT_HISTORY_QUERY_TIMEOUT_MS,
      "chat-history-count"
    );

    // Peer avatar is decorative — degrade to no avatar rather than fail (or hold up) the
    // whole chat history response over an image URL lookup.
    const peerRows = await withTimeout(
      db.select({ image: user.image }).from(user).where(eq(user.id, userId)).limit(1),
      [] as { image: string | null }[],
      CHAT_HISTORY_PEER_IMAGE_TIMEOUT_MS
    );
    const peerRow = peerRows[0];

    return jsonUncached({
      messages: rows.reverse(),
      participantImage: peerRow?.image ?? null,
      page,
      limit,
      total: countRows[0]?.count ?? 0,
    });
  } catch (error) {
    if (error instanceof QueryTimeoutError) {
      console.error("GET /api/chat/history: timed out:", error.message);
      return jsonTimeout("Chat history is taking longer than usual to load — please retry");
    }
    console.error("GET /api/chat/history:", error);
    return jsonError("Failed to load chat history", 500);
  }
}


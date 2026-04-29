import { NextRequest, connection } from "next/server";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { messages } from "@/drizzle/schema/chat-schema";
import { jsonError, jsonUncached, parseQuery } from "@/lib/api";

const querySchema = z.object({
  userId: z.string().trim().min(1),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

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

    const [rows, countRows, [peerRow]] = await Promise.all([
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
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(whereClause),
      db
        .select({ image: user.image })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1),
    ]);

    return jsonUncached({
      messages: rows.reverse(),
      participantImage: peerRow?.image ?? null,
      page,
      limit,
      total: countRows[0]?.count ?? 0,
    });
  } catch (error) {
    console.error("GET /api/chat/history:", error);
    return jsonError("Failed to load chat history", 500);
  }
}


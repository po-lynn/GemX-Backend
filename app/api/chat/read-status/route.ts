import { NextRequest, connection } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { messages } from "@/drizzle/schema/chat-schema";
import { jsonError, jsonUncached } from "@/lib/api";
import { broadcastChatEvents } from "@/lib/supabase/chat-broadcast";

const bodySchema = z.object({
  messageIds: z.array(z.string().uuid()).min(1).max(500),
});

/**
 * PATCH /api/chat/read-status
 * Mark messages as read for the current user's conversation.
 * Accepts message IDs for rows where the current user is the recipient (incoming messages).
 */
export async function PATCH(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError("Invalid input", 400);

    const { messageIds } = parsed.data;
    const updatedRows = await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(inArray(messages.id, messageIds), eq(messages.recipientId, session.user.id))
      )
      .returning({ id: messages.id, senderId: messages.senderId });

    const updatedIds = updatedRows.map((r) => r.id);
    const recipientId = session.user.id;
    const readPayload = { messageIds: updatedIds, recipientId };

    // Notify each unique sender (read receipts) and the recipient themselves (multi-tab sync).
    const uniqueSenderIds = [...new Set(updatedRows.map((r) => r.senderId))];
    const broadcastTargets = [
      ...uniqueSenderIds.map((userId) => ({
        userId,
        event: "read_update" as const,
        payload: readPayload,
      })),
      { userId: recipientId, event: "read_update" as const, payload: readPayload },
    ];
    void broadcastChatEvents(broadcastTargets).catch((e) =>
      console.error("Read-status broadcast failed:", e)
    );

    return jsonUncached({
      success: true,
      requestedCount: messageIds.length,
      updatedCount: updatedRows.length,
      messageIds: updatedIds,
    });
  } catch (error) {
    console.error("PATCH /api/chat/read-status:", error);
    return jsonError("Failed to update message status", 500);
  }
}


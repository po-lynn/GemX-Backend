import { NextRequest, connection } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { messages } from "@/drizzle/schema/chat-schema";
import { jsonError, jsonUncached } from "@/lib/api";

const bodySchema = z.object({
  messageIds: z.array(z.string().uuid()).min(1).max(500),
});

/**
 * PATCH /api/chat/read-status
 * Mark recipient-owned messages as read.
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
      .where(and(eq(messages.recipientId, session.user.id), inArray(messages.id, messageIds)))
      .returning({ id: messages.id });

    return jsonUncached({
      success: true,
      updatedCount: updatedRows.length,
      messageIds: updatedRows.map((r) => r.id),
    });
  } catch (error) {
    console.error("PATCH /api/chat/read-status:", error);
    return jsonError("Failed to update message status", 500);
  }
}


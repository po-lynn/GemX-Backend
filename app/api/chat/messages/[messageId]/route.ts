import { NextRequest, connection } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { messages } from "@/drizzle/schema/chat-schema";
import { jsonError, jsonUncached } from "@/lib/api";

const patchSchema = z
  .object({
    content: z.string().trim().max(5000).optional(),
    starred: z.boolean().optional(),
  })
  .refine((v) => v.content !== undefined || v.starred !== undefined, {
    message: "At least one of content or starred is required",
  });

function serialize(row: typeof messages.$inferSelect) {
  return {
    id: row.id,
    senderId: row.senderId,
    recipientId: row.recipientId,
    content: row.content,
    fileUrl: row.fileUrl,
    imageUrls: row.imageUrls ?? null,
    messageType: row.messageType,
    isRead: row.isRead,
    starred: row.starred ?? false,
    editedAt: row.editedAt?.toISOString?.() ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
  };
}

/**
 * PATCH /api/chat/messages/[messageId]
 * Sender-only: edit text caption / toggle starred.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ messageId: string }> }
) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const { messageId } = await context.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError("Invalid input", 400);

    const [row] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
    if (!row) return jsonError("Message not found", 404);
    if (row.senderId !== session.user.id) return jsonError("Forbidden", 403);

    const edited =
      parsed.data.content !== undefined && parsed.data.content !== row.content;

    const [saved] = await db
      .update(messages)
      .set({
        ...(parsed.data.content !== undefined ? { content: parsed.data.content } : {}),
        ...(parsed.data.starred !== undefined ? { starred: parsed.data.starred } : {}),
        ...(edited ? { editedAt: new Date() } : {}),
      })
      .where(and(eq(messages.id, messageId), eq(messages.senderId, session.user.id)))
      .returning();

    if (!saved) return jsonError("Failed to update message", 500);

    return jsonUncached({ success: true, message: serialize(saved) });
  } catch (error) {
    console.error("PATCH /api/chat/messages/[messageId]:", error);
    return jsonError("Failed to update message", 500);
  }
}

/**
 * DELETE /api/chat/messages/[messageId]
 * Sender-only removal.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ messageId: string }> }
) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const { messageId } = await context.params;

    const deleted = await db
      .delete(messages)
      .where(and(eq(messages.id, messageId), eq(messages.senderId, session.user.id)))
      .returning({ id: messages.id });

    if (deleted.length === 0) return jsonError("Message not found", 404);

    return jsonUncached({ success: true, id: deleted[0]!.id });
  } catch (error) {
    console.error("DELETE /api/chat/messages/[messageId]:", error);
    return jsonError("Failed to delete message", 500);
  }
}

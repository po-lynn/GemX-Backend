import { NextRequest, connection } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { messages, messageTypeEnum } from "@/drizzle/schema/chat-schema";
import { jsonError, jsonUncached } from "@/lib/api";
import { sendPushToUserIds } from "@/features/push/send-push";

const messageTypeValues = messageTypeEnum.enumValues;

const bodySchema = z
  .object({
    recipientId: z.string().trim().min(1),
    content: z.string().trim().max(5000).optional(),
    fileUrl: z.string().trim().url().max(2000).optional(),
    messageType: z.enum(messageTypeValues).optional(),
    tempId: z.string().trim().max(120).optional(),
  })
  .refine((v) => !!v.content || !!v.fileUrl, {
    message: "content or fileUrl is required",
  });

/**
 * POST /api/chat/messages
 * Save one chat message. Mobile clients receive it in realtime via Supabase Realtime
 * by subscribing to INSERT events on the `messages` table.
 */
export async function POST(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError("Invalid input", 400);

    const senderId = session.user.id;
    const { recipientId, content, fileUrl, tempId } = parsed.data;
    if (senderId === recipientId) return jsonError("Cannot send message to yourself", 400);

    const [recipient] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, recipientId), eq(user.archived, false)))
      .limit(1);
    if (!recipient) return jsonError("Recipient not found", 404);

    const messageType =
      parsed.data.messageType ??
      (fileUrl ? "file" : "text");

    const [saved] = await db
      .insert(messages)
      .values({
        senderId,
        recipientId,
        content: content ?? "",
        fileUrl: fileUrl ?? null,
        messageType,
        isRead: false,
      })
      .returning({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        fileUrl: messages.fileUrl,
        messageType: messages.messageType,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
      });

    if (!saved) return jsonError("Failed to save message", 500);

    // Supabase Realtime cannot reliably expose "online/offline" server-side in this app.
    // We still trigger push so recipients get notified when app is backgrounded.
    await sendPushToUserIds([recipientId], {
      title: "New message",
      body: (saved.content || "Sent you a file").slice(0, 120),
      data: {
        type: "chat_message",
        senderId,
        recipientId,
        messageId: saved.id,
      },
    });

    return jsonUncached({
      success: true,
      message: {
        ...saved,
        ...(tempId ? { tempId } : {}),
      },
    });
  } catch (error) {
    console.error("POST /api/chat/messages:", error);
    return jsonError("Failed to send message", 500);
  }
}


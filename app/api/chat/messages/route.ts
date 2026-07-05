import { NextRequest, connection } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { messages, messageTypeEnum } from "@/drizzle/schema/chat-schema";
import { jsonError, jsonUncached } from "@/lib/api";
import { sendChatMessageNotification } from "@/features/notifications/services/chat-notifications";
import { broadcastChatEvents } from "@/lib/supabase/chat-broadcast";

const messageTypeValues = messageTypeEnum.enumValues;

// DB-counted sliding window (works across serverless instances, unlike in-memory limiters).
const SEND_RATE_LIMIT_WINDOW_MS = 60_000;
const SEND_RATE_LIMIT_MAX_MESSAGES = 30;

const bodySchema = z
  .object({
    recipientId: z.string().trim().min(1),
    content: z.string().trim().max(5000).optional(),
    fileUrl: z.string().trim().url().max(2000).optional(),
    /** Same-message gallery: every image URL (first is mirrored on `file_url`). */
    imageUrls: z.array(z.string().trim().url()).min(1).max(12).optional(),
    messageType: z.enum(messageTypeValues).optional(),
    tempId: z.string().trim().max(120).optional(),
  })
  .refine((v) => !!v.content || !!v.fileUrl || (v.imageUrls && v.imageUrls.length > 0), {
    message: "content, fileUrl, or imageUrls is required",
  });

function messagePreview(saved: {
  content: string;
  imageUrls: string[] | null;
  messageType: string;
}): string {
  if (saved.content?.trim()) return saved.content;
  if (saved.imageUrls?.length) return "Sent photos";
  if (saved.messageType === "audio") return "Sent a voice message";
  if (saved.messageType === "file") return "Sent a file";
  return "New message";
}

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
    const senderName = session.user.name ?? null;
    const { recipientId, content, fileUrl, imageUrls, tempId } = parsed.data;
    if (senderId === recipientId) return jsonError("Cannot send message to yourself", 400);

    const windowStart = new Date(Date.now() - SEND_RATE_LIMIT_WINDOW_MS);
    const [recipientRows, recentRows] = await Promise.all([
      db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.id, recipientId), eq(user.archived, false)))
        .limit(1),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(and(eq(messages.senderId, senderId), gt(messages.createdAt, windowStart))),
    ]);
    if (!recipientRows[0]) return jsonError("Recipient not found", 404);
    if ((recentRows[0]?.count ?? 0) >= SEND_RATE_LIMIT_MAX_MESSAGES) {
      return jsonError("Too many messages — please slow down", 429);
    }

    const resolvedImageUrls =
      imageUrls && imageUrls.length > 0 ? imageUrls : null;
    const primaryFileUrl =
      resolvedImageUrls?.[0] ?? fileUrl ?? null;

    const messageType =
      parsed.data.messageType ??
      (resolvedImageUrls
        ? "image"
        : primaryFileUrl
          ? "file"
          : "text");

    const [saved] = await db
      .insert(messages)
      .values({
        senderId,
        recipientId,
        content: content ?? "",
        fileUrl: primaryFileUrl,
        imageUrls: resolvedImageUrls,
        messageType,
        isRead: false,
      })
      .returning({
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
      });

    if (!saved) return jsonError("Failed to save message", 500);

    void sendChatMessageNotification({
      messageId: saved.id,
      senderId,
      recipientId,
      senderName,
      preview: messagePreview(saved),
    }).catch((e) => console.error("Chat push notification failed:", e));

    const broadcastPayload = {
      id: saved.id,
      senderId: saved.senderId,
      recipientId: saved.recipientId,
      content: saved.content,
      fileUrl: saved.fileUrl,
      imageUrls: saved.imageUrls ?? null,
      messageType: saved.messageType,
      isRead: saved.isRead ?? false,
      starred: saved.starred ?? false,
      editedAt: saved.editedAt?.toISOString?.() ?? null,
      createdAt: saved.createdAt?.toISOString?.() ?? String(saved.createdAt),
    };
    void broadcastChatEvents([
      { userId: recipientId, event: "new_message", payload: broadcastPayload },
      { userId: senderId,    event: "new_message", payload: broadcastPayload },
    ]).catch((e) => console.error("Chat broadcast failed:", e));

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

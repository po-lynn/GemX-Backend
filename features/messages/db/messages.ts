import { db } from "@/drizzle/db";
import { messages } from "@/drizzle/schema/chat-schema";
import { desc, eq } from "drizzle-orm";

export type MessageRow = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  fileUrl: string | null;
  messageType: "text" | "image" | "audio" | "file";
  isRead: boolean | null;
  createdAt: Date;
};

export async function getAllMessages(): Promise<MessageRow[]> {
  return db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      content: messages.content,
      fileUrl: messages.fileUrl,
      messageType: messages.messageType,
      isRead: messages.isRead,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .orderBy(desc(messages.createdAt));
}

export async function getMessageById(id: string): Promise<MessageRow | null> {
  const [row] = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      content: messages.content,
      fileUrl: messages.fileUrl,
      messageType: messages.messageType,
      isRead: messages.isRead,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1);
  return row ?? null;
}

export async function createMessageInDb(input: {
  senderId: string;
  recipientId: string;
  content: string;
  fileUrl?: string | null;
  messageType?: "text" | "image" | "audio" | "file";
  isRead?: boolean;
}): Promise<string> {
  const [inserted] = await db
    .insert(messages)
    .values({
      senderId: input.senderId,
      recipientId: input.recipientId,
      content: input.content,
      fileUrl: input.fileUrl ?? null,
      messageType: input.messageType ?? "text",
      isRead: input.isRead ?? false,
    })
    .returning({ id: messages.id });
  if (!inserted) throw new Error("Failed to create message");
  return inserted.id;
}

export async function updateMessageInDb(
  id: string,
  input: {
    senderId?: string;
    recipientId?: string;
    content?: string;
    fileUrl?: string | null;
    messageType?: "text" | "image" | "audio" | "file";
    isRead?: boolean;
  }
): Promise<void> {
  const updates: Partial<typeof messages.$inferInsert> = {};
  if (input.senderId !== undefined) updates.senderId = input.senderId;
  if (input.recipientId !== undefined) updates.recipientId = input.recipientId;
  if (input.content !== undefined) updates.content = input.content;
  if (input.fileUrl !== undefined) updates.fileUrl = input.fileUrl;
  if (input.messageType !== undefined) updates.messageType = input.messageType;
  if (input.isRead !== undefined) updates.isRead = input.isRead;
  if (Object.keys(updates).length === 0) return;
  await db.update(messages).set(updates).where(eq(messages.id, id));
}

export async function deleteMessageInDb(id: string): Promise<boolean> {
  const deleted = await db
    .delete(messages)
    .where(eq(messages.id, id))
    .returning({ id: messages.id });
  return deleted.length > 0;
}


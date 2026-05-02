import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { messages } from "@/drizzle/schema/chat-schema";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const senderUser = alias(user, "msg_list_sender");
const recipientUser = alias(user, "msg_list_recipient");

export type MessageRow = {
  id: string;
  senderId: string;
  recipientId: string;
  senderName: string | null;
  recipientName: string | null;
  senderImage: string | null;
  recipientImage: string | null;
  senderUsername: string | null;
  senderDisplayUsername: string | null;
  recipientUsername: string | null;
  recipientDisplayUsername: string | null;
  content: string;
  fileUrl: string | null;
  messageType: "text" | "image" | "audio" | "file";
  isRead: boolean | null;
  starred: boolean | null;
  createdAt: Date;
};

export async function getAllMessages(): Promise<MessageRow[]> {
  return db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      senderName: senderUser.name,
      recipientName: recipientUser.name,
      senderImage: senderUser.image,
      recipientImage: recipientUser.image,
      senderUsername: senderUser.username,
      senderDisplayUsername: senderUser.displayUsername,
      recipientUsername: recipientUser.username,
      recipientDisplayUsername: recipientUser.displayUsername,
      content: messages.content,
      fileUrl: messages.fileUrl,
      messageType: messages.messageType,
      isRead: messages.isRead,
      starred: messages.starred,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .leftJoin(senderUser, eq(senderUser.id, messages.senderId))
    .leftJoin(recipientUser, eq(recipientUser.id, messages.recipientId))
    .orderBy(desc(messages.createdAt));
}

export async function getMessageById(id: string): Promise<MessageRow | null> {
  const [row] = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      senderName: senderUser.name,
      recipientName: recipientUser.name,
      senderImage: senderUser.image,
      recipientImage: recipientUser.image,
      senderUsername: senderUser.username,
      senderDisplayUsername: senderUser.displayUsername,
      recipientUsername: recipientUser.username,
      recipientDisplayUsername: recipientUser.displayUsername,
      content: messages.content,
      fileUrl: messages.fileUrl,
      messageType: messages.messageType,
      isRead: messages.isRead,
      starred: messages.starred,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .leftJoin(senderUser, eq(senderUser.id, messages.senderId))
    .leftJoin(recipientUser, eq(recipientUser.id, messages.recipientId))
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
    starred?: boolean;
  }
): Promise<void> {
  const updates: Partial<typeof messages.$inferInsert> = {};
  if (input.senderId !== undefined) updates.senderId = input.senderId;
  if (input.recipientId !== undefined) updates.recipientId = input.recipientId;
  if (input.content !== undefined) updates.content = input.content;
  if (input.fileUrl !== undefined) updates.fileUrl = input.fileUrl;
  if (input.messageType !== undefined) updates.messageType = input.messageType;
  if (input.isRead !== undefined) updates.isRead = input.isRead;
  if (input.starred !== undefined) updates.starred = input.starred;
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

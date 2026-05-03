"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { canAdminManageUsers } from "@/features/users/permissions/users";
import {
  messageCreateSchema,
  messageDeleteSchema,
  messageUpdateSchema,
} from "@/features/messages/schemas/messages";
import {
  createMessageInDb,
  deleteMessageInDb,
  updateMessageInDb,
} from "@/features/messages/db/messages";
import { z } from "zod";

const toggleStarSchema = z.object({
  id: z.string().uuid(),
  starred: z.enum(["true", "false"]),
});

function emptyToUndefined<T>(v: T): T | undefined {
  return (v === "" ? undefined : v) as T | undefined;
}

export async function createMessageAction(formData: FormData) {
  const parsed = messageCreateSchema.safeParse({
    senderId: formData.get("senderId"),
    recipientId: formData.get("recipientId"),
    content: formData.get("content"),
    fileUrl: emptyToUndefined(formData.get("fileUrl")),
    messageType: formData.get("messageType"),
    isRead: formData.get("isRead"),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) {
    return { error: "Unauthorized" };
  }

  try {
    const messageId = await createMessageInDb({
      senderId: parsed.data.senderId,
      recipientId: parsed.data.recipientId,
      content: parsed.data.content,
      fileUrl: parsed.data.fileUrl ?? null,
      messageType: parsed.data.messageType,
      isRead: parsed.data.isRead ?? false,
    });
    return { success: true, messageId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create message";
    return { error: message };
  }
}

export async function updateMessageAction(formData: FormData) {
  const parsed = messageUpdateSchema.safeParse({
    id: formData.get("id"),
    senderId: formData.get("senderId"),
    recipientId: formData.get("recipientId"),
    content: formData.get("content"),
    fileUrl: emptyToUndefined(formData.get("fileUrl")),
    messageType: formData.get("messageType"),
    isRead: formData.get("isRead"),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) {
    return { error: "Unauthorized" };
  }

  try {
    const { id, ...updates } = parsed.data;
    await updateMessageInDb(id, {
      ...updates,
      ...(updates.fileUrl !== undefined ? { fileUrl: updates.fileUrl ?? null } : {}),
    });
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update message";
    return { error: message };
  }
}

export async function setMessageStarredAction(formData: FormData) {
  const parsed = toggleStarSchema.safeParse({
    id: formData.get("id"),
    starred: formData.get("starred"),
  });
  if (!parsed.success) return { error: "Invalid input" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) {
    return { error: "Unauthorized" };
  }

  try {
    await updateMessageInDb(parsed.data.id, {
      starred: parsed.data.starred === "true",
    });
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update message";
    return { error: message };
  }
}

export async function deleteMessageAction(formData: FormData) {
  const parsed = messageDeleteSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) return { error: "Invalid input" };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) {
    return { error: "Unauthorized" };
  }

  const deleted = await deleteMessageInDb(parsed.data.id);
  if (!deleted) return { error: "Message not found" };
  return { success: true };
}


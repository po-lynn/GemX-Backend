"use server";

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
import { emptyToUndefined, zodErrorMessage } from "@/lib/form-data";
import { requireActionRole } from "@/lib/action-guard";

const toggleStarSchema = z.object({
  id: z.string().uuid(),
  starred: z.enum(["true", "false"]),
});


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
    return { error: zodErrorMessage(parsed.error) };
  }

  const session = await requireActionRole(canAdminManageUsers);
  if (!session) {
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
    return { error: zodErrorMessage(parsed.error) };
  }

  const session = await requireActionRole(canAdminManageUsers);
  if (!session) {
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

  const session = await requireActionRole(canAdminManageUsers);
  if (!session) {
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

  const session = await requireActionRole(canAdminManageUsers);
  if (!session) {
    return { error: "Unauthorized" };
  }

  const deleted = await deleteMessageInDb(parsed.data.id);
  if (!deleted) return { error: "Message not found" };
  return { success: true };
}


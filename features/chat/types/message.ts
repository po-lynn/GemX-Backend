export type ChatMessageType = "text" | "image" | "audio" | "file";

export type ChatMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  fileUrl: string | null;
  imageUrls?: string[] | null;
  messageType: ChatMessageType;
  isRead: boolean;
  starred?: boolean;
  editedAt?: string | null;
  createdAt: string;
};

/** Normalize Supabase `postgres_changes` row (snake_case or camelCase). */
export function normalizeChatMessageRow(raw: Record<string, unknown>): ChatMessage {
  const imageUrlsRaw = raw.image_urls ?? raw.imageUrls;
  const imageUrls = Array.isArray(imageUrlsRaw)
    ? imageUrlsRaw.filter((u): u is string => typeof u === "string")
    : null;
  const mt = raw.message_type ?? raw.messageType;
  return {
    id: String(raw.id),
    senderId: String(raw.sender_id ?? raw.senderId),
    recipientId: String(raw.recipient_id ?? raw.recipientId),
    content: String(raw.content ?? ""),
    fileUrl: (raw.file_url ?? raw.fileUrl) as string | null,
    imageUrls,
    messageType:
      mt === "image" || mt === "audio" || mt === "file" || mt === "text" ? mt : "text",
    isRead: Boolean(raw.is_read ?? raw.isRead),
    starred: Boolean(raw.starred),
    editedAt: raw.edited_at
      ? String(raw.edited_at)
      : raw.editedAt
        ? String(raw.editedAt)
        : null,
    createdAt: String(raw.created_at ?? raw.createdAt),
  };
}

export function previewFromChatMessage(m: ChatMessage): string {
  if (m.content?.trim()) return m.content.trim();
  if (m.imageUrls?.length) return "Sent photos";
  if (m.messageType === "audio") return "Sent a voice message";
  if (m.messageType === "file") return "Sent a file";
  return "New message";
}

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { messages } from "@/drizzle/schema/chat-schema";
import { getPublicProfilePresenceMap } from "@/features/users/db/profile-presence";

export type ChatConversationListItem = {
  userId: string;
  name: string;
  profileImage: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
};

type LatestSqlRow = {
  senderId: string;
  recipientId: string;
  content: string;
  fileUrl: string | null;
  imageUrls: unknown;
  messageType: string;
  createdAt: Date | string;
  peerId: string;
};

function normalizeImageUrls(value: unknown): string[] | null {
  if (value == null) return null;
  if (Array.isArray(value) && value.every((u) => typeof u === "string")) return value;
  return null;
}

export function previewLastMessage(
  content: string,
  messageType: string,
  imageUrls: string[] | null
): string {
  const trimmed = content?.trim() ?? "";
  if (trimmed.length > 0) return trimmed;
  if (messageType === "image" || (imageUrls && imageUrls.length > 0)) return "Sent photos";
  if (messageType === "audio") return "Voice message";
  if (messageType === "file") return "Sent a file";
  return "";
}

function toIsoTime(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * One row per chat peer: latest message in the thread, unread count from that peer,
 * profile fields, and session-derived online flag.
 */
export async function getChatConversationsForUser(
  currentUserId: string
): Promise<ChatConversationListItem[]> {
  const latestResult = await db.execute(sql`
    WITH ranked AS (
      SELECT
        m.sender_id AS "senderId",
        m.recipient_id AS "recipientId",
        m.content,
        m.file_url AS "fileUrl",
        m.image_urls AS "imageUrls",
        m.message_type AS "messageType",
        m.created_at AS "createdAt",
        CASE WHEN m.sender_id = ${currentUserId} THEN m.recipient_id ELSE m.sender_id END AS "peerId",
        ROW_NUMBER() OVER (
          PARTITION BY CASE WHEN m.sender_id = ${currentUserId} THEN m.recipient_id ELSE m.sender_id END
          ORDER BY m.created_at DESC
        ) AS rn
      FROM messages m
      WHERE m.sender_id = ${currentUserId} OR m.recipient_id = ${currentUserId}
    )
    SELECT "senderId", "recipientId", content, "fileUrl", "imageUrls", "messageType", "createdAt", "peerId"
    FROM ranked
    WHERE rn = 1
  `);

  const latestRows = [...latestResult] as LatestSqlRow[];
  if (latestRows.length === 0) return [];

  const peerIds = [...new Set(latestRows.map((r) => r.peerId))];

  const profiles = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(inArray(user.id, peerIds));
  const unreadRows = await db
    .select({
      senderId: messages.senderId,
      unread: sql<number>`count(*)::int`,
    })
    .from(messages)
    .where(
      and(
        eq(messages.recipientId, currentUserId),
        eq(messages.isRead, false),
        inArray(messages.senderId, peerIds)
      )
    )
    .groupBy(messages.senderId);
  const presenceMap = await getPublicProfilePresenceMap(peerIds);

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const unreadByPeer = new Map<string, number>();
  for (const row of unreadRows) {
    unreadByPeer.set(row.senderId, row.unread ?? 0);
  }

  const items: ChatConversationListItem[] = latestRows.map((row) => {
    const imageUrls = normalizeImageUrls(row.imageUrls);
    const prof = profileById.get(row.peerId);
    const presence = presenceMap.get(row.peerId);
    return {
      userId: row.peerId,
      name: prof?.name ?? "Unknown user",
      profileImage: prof?.image ?? null,
      lastMessage: previewLastMessage(row.content, row.messageType, imageUrls),
      lastMessageTime: toIsoTime(row.createdAt),
      unreadCount: unreadByPeer.get(row.peerId) ?? 0,
      isOnline: presence?.presence === "online",
    };
  });

  items.sort(
    (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
  );

  return items;
}

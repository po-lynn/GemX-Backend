import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { messages } from "@/drizzle/schema/chat-schema";
import {
  SESSION_PRESENCE_ONLINE_WINDOW_MS,
  getPresenceMapsForUserIds,
} from "@/features/chat/db/session-presence";

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

function previewLastMessage(
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
 * Cheap change-detection fingerprint for the SSE conversations stream.
 *
 * One index-only aggregate over the user's messages: any new message (max created_at),
 * edit (max edited_at), delete (total count), or read-state change (unread count)
 * alters the signature. Presence (isOnline) is NOT covered — the stream forces a
 * periodic full refresh for that. Roughly an order of magnitude cheaper than the
 * full 3-query pipeline in getChatConversationsForUser.
 */
export async function getChatActivitySignature(currentUserId: string): Promise<string> {
  const result = await db.execute(sql`
    SELECT
      max(m.created_at)  AS "lastCreated",
      max(m.edited_at)   AS "lastEdited",
      count(*)           AS "total",
      count(*) FILTER (WHERE m.recipient_id = ${currentUserId} AND m.is_read = false) AS "unread"
    FROM messages m
    WHERE m.sender_id = ${currentUserId} OR m.recipient_id = ${currentUserId}
  `);
  const row = [...result][0] as Record<string, unknown> | undefined;
  return JSON.stringify(row ?? {});
}

/**
 * One row per chat peer: latest message in the thread, unread count from that peer,
 * profile fields, and session-derived online flag.
 *
 * Uses DISTINCT ON instead of ROW_NUMBER() — PostgreSQL stops at the first matching
 * row per peer (ordered by created_at DESC) rather than ranking the full result set.
 * Also merges the two session-presence queries into one round-trip.
 * Total: 4 queries → 3 queries per SSE tick.
 */
export async function getChatConversationsForUser(
  currentUserId: string
): Promise<ChatConversationListItem[]> {
  // DISTINCT ON is PostgreSQL-specific: picks the first row per (peerId) after ORDER BY,
  // which is always the latest message — much cheaper than ROW_NUMBER on large tables.
  //
  // peerId is computed once in the subquery: Postgres requires the DISTINCT ON
  // expression to be *structurally identical* to the leading ORDER BY expression
  // (error 42P10), and each ${currentUserId} interpolation becomes a distinct
  // bind placeholder ($1 vs $5), so repeating the CASE inline can never match.
  const latestResult = await db.execute(sql`
    SELECT DISTINCT ON (t."peerId") t.*
    FROM (
      SELECT
        m.sender_id        AS "senderId",
        m.recipient_id     AS "recipientId",
        m.content,
        m.file_url         AS "fileUrl",
        m.image_urls       AS "imageUrls",
        m.message_type     AS "messageType",
        m.created_at       AS "createdAt",
        CASE WHEN m.sender_id = ${currentUserId} THEN m.recipient_id ELSE m.sender_id END AS "peerId"
      FROM messages m
      WHERE m.sender_id = ${currentUserId} OR m.recipient_id = ${currentUserId}
    ) t
    ORDER BY t."peerId", t."createdAt" DESC
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

  // Single query for both "active session" and "last seen" presence data.
  const { activeMap } = await getPresenceMapsForUserIds(peerIds);

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const unreadByPeer = new Map<string, number>();
  for (const row of unreadRows) {
    unreadByPeer.set(row.senderId, row.unread ?? 0);
  }

  const items: ChatConversationListItem[] = latestRows.map((row) => {
    const imageUrls = normalizeImageUrls(row.imageUrls);
    const prof = profileById.get(row.peerId);
    const activeLast = activeMap.get(row.peerId) ?? null;
    const isOnline =
      activeLast !== null &&
      Date.now() - activeLast.getTime() < SESSION_PRESENCE_ONLINE_WINDOW_MS;
    return {
      userId: row.peerId,
      name: prof?.name ?? "Unknown user",
      profileImage: prof?.image ?? null,
      lastMessage: previewLastMessage(row.content, row.messageType, imageUrls),
      lastMessageTime: toIsoTime(row.createdAt),
      unreadCount: unreadByPeer.get(row.peerId) ?? 0,
      isOnline,
    };
  });

  items.sort(
    (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
  );

  return items;
}

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { messages } from "@/drizzle/schema/chat-schema";

export type AdminConversationParticipant = {
  id: string;
  name: string;
  image: string | null;
  role: string;
};

export type AdminConversationListItem = {
  participants: [AdminConversationParticipant, AdminConversationParticipant];
  lastMessage: string;
  lastMessageTime: string;
  lastMessageType: string;
};

type PairRow = {
  lastSenderId: string;
  lastRecipientId: string;
  content: string;
  fileUrl: string | null;
  imageUrls: unknown;
  messageType: string;
  createdAt: Date | string;
};

function toIsoTime(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function normalizeImageUrls(value: unknown): string[] | null {
  if (value == null) return null;
  if (Array.isArray(value) && value.every((u) => typeof u === "string")) return value;
  return null;
}

function previewLastMessage(content: string, messageType: string, imageUrls: unknown): string {
  const trimmed = content?.trim() ?? "";
  if (trimmed.length > 0) return trimmed;
  const hasImages = Array.isArray(imageUrls) && imageUrls.length > 0;
  if (messageType === "image" || hasImages) return "Sent photos";
  if (messageType === "audio") return "Voice message";
  if (messageType === "file") return "Sent a file";
  return "";
}

/** Total distinct 1:1 conversation pairs across every user in the system. */
export async function getAllConversationsCount(): Promise<number> {
  const result = await db.execute(sql`
    SELECT count(*)::int AS "count" FROM (
      SELECT DISTINCT LEAST(sender_id, recipient_id) || ':' || GREATEST(sender_id, recipient_id) AS pair_key
      FROM messages
    ) t
  `);
  const row = [...result][0] as { count: number } | undefined;
  return row?.count ?? 0;
}

/**
 * Every 1:1 conversation in the system (not scoped to any single user), one row per pair,
 * most-recently-active first. Backs the admin-only "all conversations" oversight view —
 * see docs/technical/admin-all-conversations.md.
 *
 * DISTINCT ON mirrors `getChatConversationsForUser` (features/chat/db/conversations-list.ts):
 * cheaper than ROW_NUMBER since Postgres stops at the first row per pair after ORDER BY.
 */
export async function getAllConversationsForAdmin(
  page: number,
  limit: number
): Promise<AdminConversationListItem[]> {
  const offset = (page - 1) * limit;
  const result = await db.execute(sql`
    WITH pairs AS (
      SELECT DISTINCT ON (pair_key)
        pair_key,
        sender_id    AS "lastSenderId",
        recipient_id AS "lastRecipientId",
        content,
        file_url     AS "fileUrl",
        image_urls   AS "imageUrls",
        message_type AS "messageType",
        created_at   AS "createdAt"
      FROM (
        SELECT
          m.sender_id, m.recipient_id, m.content, m.file_url, m.image_urls, m.message_type, m.created_at,
          LEAST(m.sender_id, m.recipient_id) || ':' || GREATEST(m.sender_id, m.recipient_id) AS pair_key
        FROM messages m
      ) x
      ORDER BY pair_key, created_at DESC
    )
    SELECT * FROM pairs ORDER BY "createdAt" DESC LIMIT ${limit} OFFSET ${offset}
  `);
  const rows = [...result] as PairRow[];
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.flatMap((r) => [r.lastSenderId, r.lastRecipientId]))];
  const profiles = await db
    .select({ id: user.id, name: user.name, image: user.image, role: user.role })
    .from(user)
    .where(inArray(user.id, userIds));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const fallback = (id: string): AdminConversationParticipant => ({
    id,
    name: "Unknown user",
    image: null,
    role: "",
  });

  return rows.map((row) => ({
    participants: [
      profileById.get(row.lastSenderId) ?? fallback(row.lastSenderId),
      profileById.get(row.lastRecipientId) ?? fallback(row.lastRecipientId),
    ],
    lastMessage: previewLastMessage(row.content, row.messageType, row.imageUrls),
    lastMessageTime: toIsoTime(row.createdAt),
    lastMessageType: row.messageType,
  }));
}

export type AdminConversationMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  fileUrl: string | null;
  imageUrls: string[] | null;
  messageType: string;
  createdAt: string;
};

/** Full read-only message history between two arbitrary users, for admin oversight. */
export async function getConversationMessagesForAdmin(
  userA: string,
  userB: string,
  page: number,
  limit: number
): Promise<{ messages: AdminConversationMessage[]; total: number }> {
  const offset = (page - 1) * limit;
  const whereClause = or(
    and(eq(messages.senderId, userA), eq(messages.recipientId, userB)),
    and(eq(messages.senderId, userB), eq(messages.recipientId, userA))
  );

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        content: messages.content,
        fileUrl: messages.fileUrl,
        imageUrls: messages.imageUrls,
        messageType: messages.messageType,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(whereClause)
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(messages).where(whereClause),
  ]);

  const ordered = rows
    .slice()
    .reverse()
    .map((r) => ({
      id: r.id,
      senderId: r.senderId,
      recipientId: r.recipientId,
      content: r.content,
      fileUrl: r.fileUrl,
      imageUrls: normalizeImageUrls(r.imageUrls),
      messageType: r.messageType,
      createdAt: toIsoTime(r.createdAt),
    }));

  return { messages: ordered, total: countRows[0]?.count ?? 0 };
}

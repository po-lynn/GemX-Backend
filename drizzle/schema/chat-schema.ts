import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const messageTypeEnum = pgEnum("message_type", ["text", "image", "audio", "file"]);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    senderId: text("sender_id").notNull(),
    recipientId: text("recipient_id").notNull(),
    content: text("content").notNull(),
    fileUrl: text("file_url"),
    /** When set (same-message gallery), includes every image URL; `file_url` mirrors `[0]` for older clients. */
    imageUrls: jsonb("image_urls").$type<string[] | null>(),
    messageType: messageTypeEnum("message_type").default("text").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    starred: boolean("starred").default(false).notNull(),
    editedAt: timestamp("edited_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Outgoing direction: history and latest-per-peer. NOT the send rate-limit count —
    // that query has no recipientId predicate, so createdAt can't be used as an index
    // range here (btree leftmost-prefix rules require recipientId to be equality-bound
    // first); see senderCreatedAtIdx below for the index that actually serves it.
    chatIdx: index("chat_idx").on(
      table.senderId,
      table.recipientId,
      table.createdAt.desc()
    ),
    // Incoming direction: the recipient half of `sender = me OR recipient = me`.
    recipientChatIdx: index("recipient_chat_idx").on(
      table.recipientId,
      table.senderId,
      table.createdAt.desc()
    ),
    // Unread counts per peer — partial: only unread rows are indexed.
    unreadByRecipientIdx: index("unread_by_recipient_idx")
      .on(table.recipientId, table.senderId)
      .where(sql`${table.isRead} = false`),
    // Dedicated to the send-rate-limit count (`sender_id = ? AND created_at > windowStart`,
    // no recipient predicate) — deliberately a separate index rather than reusing chatIdx's
    // column order, so this stays a true bounded range scan over the last N seconds
    // regardless of how many total messages that sender has ever sent.
    senderCreatedAtIdx: index("messages_sender_created_at_idx").on(
      table.senderId,
      table.createdAt
    ),
  })
).enableRLS();

/**
 * Per-admin "last viewed the oversight feed" cursor. `messages.isRead` is scoped to
 * the actual recipient and doesn't apply to admins overseeing conversations they
 * aren't part of — this table backs the nav bar notification bell's system-wide
 * "new since last view" count for role === "admin" instead.
 */
export const adminChatCursor = pgTable("admin_chat_cursor", {
  userId: text("user_id").primaryKey(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
}).enableRLS();


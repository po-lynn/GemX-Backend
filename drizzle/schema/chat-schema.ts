import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const messageTypeEnum = pgEnum("message_type", ["text", "image", "audio", "file"]);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    senderId: text("sender_id").notNull(),
    recipientId: text("recipient_id").notNull(),
    content: text("content").notNull(),
    fileUrl: text("file_url"),
    messageType: messageTypeEnum("message_type").default("text").notNull(),
    isRead: boolean("is_read").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    chatIdx: index("chat_idx").on(table.senderId, table.recipientId),
  })
);


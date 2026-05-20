import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Tracks which 1:1 chat thread a user is actively viewing (mobile/web heartbeat).
 * Used to suppress push when the receiver already has that conversation open.
 */
export const userActiveChatView = pgTable("user_active_chat_view", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  peerId: text("peer_id").notNull(),
  conversationId: text("conversation_id").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

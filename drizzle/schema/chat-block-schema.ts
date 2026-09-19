import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./auth-schema"

/**
 * Self-service block, deliberately separate from `messagingRestriction`
 * (chat-moderation-schema.ts) — that table is admin-issued moderation (mute/ban,
 * evidence of abuse, survives account deletion); this one is an ordinary user
 * preference ("I don't want to hear from this person"), so both sides cascade away
 * with the account instead of lingering as a dangling record.
 *
 * A block row is directional (who blocked whom), but enforcement in the send path and
 * conversation list checks BOTH directions — once either party blocks the other, new
 * messages stop flowing and the thread drops out of both inboxes. The direction is
 * still recorded so only the blocker can see and lift their own block.
 */
export const chatBlock = pgTable(
  "chat_block",
  {
    blockerId: text("blocker_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.blockerId, table.blockedId] }),
    // Supports the enforcement lookup's "am I blocked by this peer" direction.
    index("chat_block_blocked_idx").on(table.blockedId),
  ]
).enableRLS()

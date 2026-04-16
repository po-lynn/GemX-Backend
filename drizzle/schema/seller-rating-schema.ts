import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-schema"

/**
 * One user rates another user (seller) with a score.
 * Unique per (rater, seller); POST upserts.
 */
export const sellerRating = pgTable(
  "seller_rating",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    raterUserId: text("rater_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sellerUserId: text("seller_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("seller_rating_rater_seller_unique").on(
      table.raterUserId,
      table.sellerUserId
    ),
    index("seller_rating_rater_user_id_idx").on(table.raterUserId),
    index("seller_rating_seller_user_id_idx").on(table.sellerUserId),
    index("seller_rating_score_idx").on(table.score),
    index("seller_rating_created_at_idx").on(table.createdAt),
  ]
)

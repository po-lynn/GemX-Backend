import { index, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { ratingTag } from "./rating-tag-schema"
import { sellerRating } from "./seller-rating-schema"

/**
 * Links a seller_rating row to preset rating_tags (many-to-many).
 */
export const ratingTagMap = pgTable(
  "rating_tag_map",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ratingId: uuid("rating_id")
      .notNull()
      .references(() => sellerRating.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => ratingTag.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("rating_tag_map_rating_tag_unique").on(
      table.ratingId,
      table.tagId
    ),
    index("rating_tag_map_rating_id_idx").on(table.ratingId),
    index("rating_tag_map_tag_id_idx").on(table.tagId),
  ]
)

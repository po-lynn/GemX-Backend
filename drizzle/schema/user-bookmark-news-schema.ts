import { relations } from "drizzle-orm"
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-schema"
import { news } from "./news-schema"

/**
 * User-saved news articles (bookmarks) for the mobile "Saved" screen.
 */
export const userBookmarkNews = pgTable(
  "user_bookmark_news",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    newsId: uuid("news_id")
      .notNull()
      .references(() => news.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_bookmark_news_user_news_unique").on(table.userId, table.newsId),
    index("user_bookmark_news_user_id_idx").on(table.userId),
    index("user_bookmark_news_news_id_idx").on(table.newsId),
    index("user_bookmark_news_created_at_idx").on(table.createdAt),
  ]
)

export const userBookmarkNewsRelations = relations(userBookmarkNews, ({ one }) => ({
  user: one(user, {
    fields: [userBookmarkNews.userId],
    references: [user.id],
  }),
  news: one(news, {
    fields: [userBookmarkNews.newsId],
    references: [news.id],
  }),
}))

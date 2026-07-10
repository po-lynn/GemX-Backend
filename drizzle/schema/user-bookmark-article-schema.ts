import { relations } from "drizzle-orm"
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-schema"
import { articles } from "./articles-schema"

/**
 * User-saved articles (bookmarks) for the mobile "Saved" screen.
 */
export const userBookmarkArticle = pgTable(
  "user_bookmark_article",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_bookmark_article_user_article_unique").on(table.userId, table.articleId),
    index("user_bookmark_article_user_id_idx").on(table.userId),
    index("user_bookmark_article_article_id_idx").on(table.articleId),
    index("user_bookmark_article_created_at_idx").on(table.createdAt),
  ]
)

export const userBookmarkArticleRelations = relations(userBookmarkArticle, ({ one }) => ({
  user: one(user, {
    fields: [userBookmarkArticle.userId],
    references: [user.id],
  }),
  article: one(articles, {
    fields: [userBookmarkArticle.articleId],
    references: [articles.id],
  }),
}))

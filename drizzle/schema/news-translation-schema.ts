import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { news } from "./news-schema";

export const newsTranslation = pgTable(
  "news_translation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    newsId: uuid("news_id")
      .notNull()
      .references(() => news.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull().default("[]"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("news_translation_news_language_unique").on(table.newsId, table.language),
    index("news_translation_news_id_idx").on(table.newsId),
    index("news_translation_language_idx").on(table.language),
  ]
);

import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const articles = pgTable("articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  /** Source language of title/content: English | Myanmar | Thai | Korean */
  language: text("language").notNull().default("English"),
  titleEn: text("title_en"),
  titleMy: text("title_my"),
  titleTh: text("title_th"),
  titleKo: text("title_ko"),
  content: text("content").notNull().default("[]"),
  contentEn: text("content_en"),
  contentMy: text("content_my"),
  contentTh: text("content_th"),
  contentKo: text("content_ko"),
  author: text("author").notNull().default(""),
  category: text("category").notNull().default("general"),
  coverImage: text("cover_image"),
  isFeatured: boolean("is_featured").notNull().default(false),
  status: text("status").notNull().default("draft"),
  publishDate: timestamp("publish_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

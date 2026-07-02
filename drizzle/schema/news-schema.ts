import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const news = pgTable("news", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content").notNull().default("[]"),
  author: text("author").notNull().default("Gem X Newsroom"),
  category: text("category").notNull().default("general"),
  coverImage: text("cover_image"),
  isFeatured: boolean("is_featured").notNull().default(false),
  status: text("status").notNull().default("draft"),
  publish: timestamp("publish"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

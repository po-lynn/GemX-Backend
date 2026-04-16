import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const news = pgTable("news", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  language: text("language").notNull().default("English"),
  content: text("content").notNull().default("[]"),
  status: text("status").notNull().default("draft"),
  publish: timestamp("publish"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

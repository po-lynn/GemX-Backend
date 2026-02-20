import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const news = pgTable("news", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content").notNull().default("[]"),
  status: text("status").notNull().default("draft"),
  publish: timestamp("publish"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

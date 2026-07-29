import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Public "Contact us" form submission from an anonymous website visitor
 * (no `userId` — submitters are not authenticated).
 */
export const contactMessage = pgTable(
  "contact_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    message: text("message").notNull(),
    /** Admin workflow: pending | reviewed | dismissed (extensible) */
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("contact_message_created_at_idx").on(table.createdAt),
    index("contact_message_status_idx").on(table.status),
  ]
);

import { bigint, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-schema"
import { currencyEnum, product } from "./product-schema"
import { messageTypeEnum } from "./chat-schema"

/**
 * Server-enforced lifecycle for an escrow case's messaging thread. GemX coordinates
 * (verifies stone/identities, supervises handover) — it never holds funds; payment
 * moves directly between buyer and seller. `cancelled`/`rejected`/`disputed` are
 * off-ramps reachable from any active (non-terminal) state; see
 * features/escrow-cases/lib/state-machine.ts for the transition table.
 */
export const escrowCaseStateEnum = pgEnum("escrow_case_state", [
  "requested",
  "agent_assigned",
  "verification",
  "payment_pending",
  "handover_scheduled",
  "handover_confirmed",
  "completed",
  "cancelled",
  "rejected",
  "disputed",
])

/**
 * The minimum case model needed to hang a dedicated buyer+seller+agent thread on —
 * not the full escrow operations console (out of scope for this feature). Created by
 * staff in the admin panel once an initial contact (via the existing 1:1 escrow chat)
 * has been reviewed; there is no mobile-facing case-creation endpoint.
 *
 * buyerId/sellerId have no onDelete (unlike moderation-style records, this is a
 * financial record with an agreed price and fee terms — it must survive account
 * deletion, not cascade away). assignedAgentId is "set null" because reassignment
 * must survive an agent's account being removed.
 */
export const escrowCase = pgTable(
  "escrow_case",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => user.id),
    sellerId: text("seller_id")
      .notNull()
      .references(() => user.id),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => product.id),
    assignedAgentId: text("assigned_agent_id").references(() => user.id, { onDelete: "set null" }),
    state: escrowCaseStateEnum("state").notNull().default("requested"),
    // Bumped on every state write; drives the agent inbox's SLA-age sort.
    stateEnteredAt: timestamp("state_entered_at").defaultNow().notNull(),
    // Integer minor units, never float (e.g. cents for USD). MMK has no real circulating
    // subunit — do not assume a 2-decimal exponent for it; see features/escrow-cases/lib/money.ts.
    agreedPriceMinor: bigint("agreed_price_minor", { mode: "number" }).notNull(),
    currency: currencyEnum("currency").notNull(),
    // Fee terms are snapshotted from escrow_service_setting at case-creation time so an
    // in-flight case's fee never retroactively changes when the global config is edited.
    feeBps: integer("fee_bps").notNull(),
    buyerFeeShareBps: integer("buyer_fee_share_bps").notNull().default(5000),
    sellerFeeShareBps: integer("seller_fee_share_bps").notNull().default(5000),
    feeMinMinor: bigint("fee_min_minor", { mode: "number" }),
    feeCapMinor: bigint("fee_cap_minor", { mode: "number" }),
    nextActionNote: text("next_action_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("escrow_case_assigned_agent_state_idx").on(table.assignedAgentId, table.state),
    index("escrow_case_buyer_idx").on(table.buyerId),
    index("escrow_case_seller_idx").on(table.sellerId),
    index("escrow_case_listing_idx").on(table.listingId),
    index("escrow_case_state_entered_at_idx").on(table.stateEnteredAt),
  ]
).enableRLS()

export const escrowCaseMessageKindEnum = pgEnum("escrow_case_message_kind", ["message", "system"])

/**
 * The side channel: "case" is visible to buyer+seller+agent (the normal case thread);
 * "agent_buyer"/"agent_seller" are visible only to that one party plus the current
 * assigned agent (and supervisors via the audited read-only viewer, never as ordinary
 * participants). Enforced both in every query's WHERE clause and in the authorization
 * layer (features/escrow-cases/lib/case-access.ts) — defense in depth.
 */
export const escrowCaseMessageVisibilityEnum = pgEnum("escrow_case_message_visibility", [
  "case",
  "agent_buyer",
  "agent_seller",
])

export const escrowCaseSystemEventTypeEnum = pgEnum("escrow_case_system_event_type", [
  "case_created",
  "state_changed",
  "assigned",
  "reassigned",
])

/**
 * Case-thread messages. Deliberately a separate table from the flat `messages` table
 * (chat-schema.ts), not an extension of it: `messages` is strictly 2-party (senderId/
 * recipientId) with no conversation entity, and every existing query/index assumes
 * exactly one counterpart. Mobile 1:1 chat and `/api/chat/*` are untouched by this table.
 *
 * `kind` (message|system) is a dedicated column, not the reused `messageType` enum below
 * — that enum already means "attachment shape" (text/image/audio/file) everywhere it's
 * consumed today, and overloading it with authorship/purpose was flagged as a bad fit.
 * senderId is "set null" and nullable only for actor-less system rows.
 * No editedAt/starred columns: case messages are immutable evidence, never edited.
 */
export const escrowCaseMessage = pgTable(
  "escrow_case_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => escrowCase.id, { onDelete: "cascade" }),
    senderId: text("sender_id").references(() => user.id, { onDelete: "set null" }),
    kind: escrowCaseMessageKindEnum("kind").notNull().default("message"),
    visibility: escrowCaseMessageVisibilityEnum("visibility").notNull().default("case"),
    content: text("content").notNull().default(""),
    fileUrl: text("file_url"),
    imageUrls: jsonb("image_urls").$type<string[] | null>(),
    // Attachment SHAPE only (text/image/audio/file) — the same concept as chat-schema.ts's
    // messageType, reused rather than duplicated, but under its own unambiguous column
    // name so this table never inherits that column's authorship-overload problem.
    attachmentType: messageTypeEnum("attachment_type").default("text").notNull(),
    // Set only when kind = "system"; used to render localized, structured system copy
    // (e.g. { from: "verification", to: "payment_pending" } or { fromAgentId, toAgentId }).
    // "Not editable" is enforced at the route/action layer, not by schema.
    systemEventType: escrowCaseSystemEventTypeEnum("system_event_type"),
    systemEventPayload: jsonb("system_event_payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("escrow_case_message_case_created_idx").on(table.caseId, table.createdAt),
    index("escrow_case_message_case_visibility_idx").on(table.caseId, table.visibility),
    index("escrow_case_message_sender_idx").on(table.senderId),
    // Dedicated to the send-rate-limit count (senderId = ? AND createdAt > windowStart) —
    // senderIdx alone has no createdAt column, so that query would otherwise heap-fetch
    // every case message that sender has ever sent. Same rationale as messages'
    // senderCreatedAtIdx in chat-schema.ts.
    index("escrow_case_message_sender_created_at_idx").on(table.senderId, table.createdAt),
  ]
).enableRLS()

/**
 * Evidence linked to the CASE, not only the message (photos, certificates, payment
 * slips): `messageId` is a nullable, "set null" soft link so editing/removing the
 * originating message never orphans evidence, and admins can list all case evidence
 * with one `WHERE caseId = ?` query.
 */
export const escrowCaseAttachment = pgTable(
  "escrow_case_attachment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => escrowCase.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => escrowCaseMessage.id, { onDelete: "set null" }),
    uploadedByUserId: text("uploaded_by_user_id").references(() => user.id, { onDelete: "set null" }),
    url: text("url").notNull(),
    fileType: messageTypeEnum("file_type").notNull(),
    label: text("label"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("escrow_case_attachment_case_idx").on(table.caseId, table.createdAt),
    index("escrow_case_attachment_message_idx").on(table.messageId),
  ]
).enableRLS()

/**
 * Per-(case, viewer) "last read" cursor — a 3-party analog of the flat table's single
 * `isRead` boolean, which can't express "unread for whom" once there are 3 participants.
 * Drives the agent inbox's unread-first sort.
 */
export const escrowCaseReadCursor = pgTable(
  "escrow_case_read_cursor",
  {
    caseId: uuid("case_id")
      .notNull()
      .references(() => escrowCase.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.caseId, table.userId] })]
).enableRLS()

import { sql } from "drizzle-orm"
import { check, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth-schema"
import { escrowCaseMessage } from "./escrow-case-schema"
import { messages } from "./chat-schema"

export const messagingRestrictionTypeEnum = pgEnum("messaging_restriction_type", ["mute", "ban"])

/**
 * Chat-scoped mute/ban, deliberately separate from Better Auth's global
 * `user.banned`/`banReason`/`banExpires` (a site-wide sign-in ban, unrelated to
 * messaging and not checked in the send path today). userId has no onDelete: a
 * restriction record is evidence of prior abuse and must not vanish if the
 * restricted account is later deleted.
 */
export const messagingRestriction = pgTable(
  "messaging_restriction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    restrictionType: messagingRestrictionTypeEnum("restriction_type").notNull(),
    reason: text("reason").notNull(),
    issuedByAdminId: text("issued_by_admin_id").references(() => user.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at").defaultNow().notNull(),
    // Null = indefinite (typical for a ban; a mute normally sets this).
    expiresAt: timestamp("expires_at"),
    liftedAt: timestamp("lifted_at"),
    liftedByAdminId: text("lifted_by_admin_id").references(() => user.id, { onDelete: "set null" }),
    liftReason: text("lift_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Partial index: only unlifted (potentially active) restrictions matter for the
    // enforcement lookup — mirrors chat-schema.ts's unreadByRecipientIdx style.
    index("messaging_restriction_user_active_idx")
      .on(table.userId, table.createdAt)
      .where(sql`${table.liftedAt} IS NULL`),
  ]
).enableRLS()

export const messageReportStatusEnum = pgEnum("message_report_status", ["open", "dismissed", "actioned"])
export const messageReportResolutionEnum = pgEnum("message_report_resolution", [
  "dismiss",
  "warn",
  "delete_message",
  "mute_user",
  "ban_user",
])

/**
 * Points at either a flat `messages` row or an `escrow_case_message` row (exactly one,
 * enforced by the CHECK below) since the two message models are genuinely separate
 * tables — this is the one bridge point between them. `contentSnapshot` is required
 * because deleting a flat message today is a hard delete with no history.
 *
 * Note: end-user report *submission* needs a mobile endpoint, which is out of scope
 * for this admin-backend-only task (see OPEN_QUESTIONS.md). This table backs the
 * admin-side reports queue and resolution flow; rows are seeded by moderator-initiated
 * reports (filed while reviewing a thread) until that mobile endpoint exists.
 */
export const messageReport = pgTable(
  "message_report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flatMessageId: uuid("flat_message_id").references(() => messages.id, { onDelete: "set null" }),
    caseMessageId: uuid("case_message_id").references(() => escrowCaseMessage.id, { onDelete: "set null" }),
    reporterId: text("reporter_id").references(() => user.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    contentSnapshot: text("content_snapshot").notNull(),
    status: messageReportStatusEnum("status").notNull().default("open"),
    resolvedAt: timestamp("resolved_at"),
    resolvedByAdminId: text("resolved_by_admin_id").references(() => user.id, { onDelete: "set null" }),
    resolutionAction: messageReportResolutionEnum("resolution_action"),
    resolutionReason: text("resolution_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("message_report_status_idx").on(table.status, table.createdAt),
    index("message_report_flat_message_idx").on(table.flatMessageId),
    index("message_report_case_message_idx").on(table.caseMessageId),
    check(
      "message_report_exactly_one_target",
      sql`(${table.flatMessageId} IS NOT NULL) <> (${table.caseMessageId} IS NOT NULL)`
    ),
  ]
).enableRLS()

export const escrowChatAuditActionEnum = pgEnum("escrow_chat_audit_action", [
  "thread_viewed",
  "side_channel_message_sent",
  "case_assigned",
  "case_reassigned",
  "state_changed",
  "report_dismissed",
  "report_actioned",
  "user_muted",
  "user_banned",
  "user_restriction_lifted",
])
export const escrowChatAuditTargetEnum = pgEnum("escrow_chat_audit_target", [
  "escrow_case",
  "flat_message",
  "case_message",
  "user",
  "report",
])

/**
 * One unified append-only audit table for escrow-case and chat-moderation actions
 * (thread views, moderation actions, mutes/bans, side-channel messages, assignment/
 * reassignment, state changes) — not a per-domain table like reputation's, because
 * nothing here doubles as live state the way `sellerArchive` does; actual state lives
 * in escrow_case.state / messagingRestriction / message_report.status. targetId is
 * polymorphic (text, not a real FK) across the 5 target kinds — application-level
 * discipline required, same trade-off message_report already makes with two FKs,
 * just pushed one level further. actorId is "set null" so deleting an admin/agent
 * account never destroys audit history.
 */
export const escrowChatAuditLog = pgTable(
  "escrow_chat_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    actionType: escrowChatAuditActionEnum("action_type").notNull(),
    targetType: escrowChatAuditTargetEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    beforeState: jsonb("before_state").$type<Record<string, unknown> | null>(),
    afterState: jsonb("after_state").$type<Record<string, unknown> | null>(),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("escrow_chat_audit_log_target_idx").on(table.targetType, table.targetId, table.createdAt),
    index("escrow_chat_audit_log_actor_idx").on(table.actorId, table.createdAt),
    index("escrow_chat_audit_log_action_idx").on(table.actionType, table.createdAt),
  ]
).enableRLS()

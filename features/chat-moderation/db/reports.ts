// Reports queue backing (message_report) — see chat-moderation-schema.ts's header
// comment: end-user report *submission* needs a mobile endpoint (out of scope here),
// so today rows are seeded by a moderator filing a report while reviewing a thread
// (see actions/reports.ts's fileMessageReportAction).

import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/drizzle/db"
import {
  messageReport,
  messageReportResolutionEnum,
  messageReportStatusEnum,
  escrowChatAuditLog,
} from "@/drizzle/schema/chat-moderation-schema"
import { messages } from "@/drizzle/schema/chat-schema"
import { escrowCaseMessage } from "@/drizzle/schema/escrow-case-schema"
import { user } from "@/drizzle/schema/auth-schema"
import { issueRestriction } from "@/features/chat-moderation/db/restrictions"

export type MessageReportStatus = (typeof messageReportStatusEnum.enumValues)[number]
export type MessageReportResolution = (typeof messageReportResolutionEnum.enumValues)[number]

export type MessageReportRow = {
  id: string
  flatMessageId: string | null
  caseMessageId: string | null
  reporterId: string | null
  reporterName: string | null
  reason: string
  contentSnapshot: string
  status: MessageReportStatus
  resolvedAt: Date | null
  resolvedByAdminId: string | null
  resolutionAction: MessageReportResolution | null
  resolutionReason: string | null
  createdAt: Date
  // Best-effort denormalized context for the queue UI — null if the underlying
  // message/sender is gone (flat messages are hard-deleted; a resolved
  // delete_message report is expected to end up here).
  senderId: string | null
  senderName: string | null
}

export async function createMessageReport(params: {
  flatMessageId?: string
  caseMessageId?: string
  reporterId: string
  reason: string
  contentSnapshot: string
}): Promise<{ id: string }> {
  const [inserted] = await db
    .insert(messageReport)
    .values({
      flatMessageId: params.flatMessageId ?? null,
      caseMessageId: params.caseMessageId ?? null,
      reporterId: params.reporterId,
      reason: params.reason,
      contentSnapshot: params.contentSnapshot,
    })
    .returning({ id: messageReport.id })
  if (!inserted) throw new Error("Failed to create message report")
  return inserted
}

export async function listMessageReports(params: { status?: MessageReportStatus }): Promise<MessageReportRow[]> {
  const reporterUser = user
  const conditions = params.status ? [eq(messageReport.status, params.status)] : []

  const rows = await db
    .select({
      id: messageReport.id,
      flatMessageId: messageReport.flatMessageId,
      caseMessageId: messageReport.caseMessageId,
      reporterId: messageReport.reporterId,
      reporterName: reporterUser.name,
      reason: messageReport.reason,
      contentSnapshot: messageReport.contentSnapshot,
      status: messageReport.status,
      resolvedAt: messageReport.resolvedAt,
      resolvedByAdminId: messageReport.resolvedByAdminId,
      resolutionAction: messageReport.resolutionAction,
      resolutionReason: messageReport.resolutionReason,
      createdAt: messageReport.createdAt,
    })
    .from(messageReport)
    .leftJoin(reporterUser, eq(reporterUser.id, messageReport.reporterId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(messageReport.createdAt))
    .limit(200)

  return resolveSenderNames(rows)
}

async function resolveSenderNames(
  rows: Array<{
    id: string
    flatMessageId: string | null
    caseMessageId: string | null
    reporterId: string | null
    reporterName: string | null
    reason: string
    contentSnapshot: string
    status: MessageReportStatus
    resolvedAt: Date | null
    resolvedByAdminId: string | null
    resolutionAction: MessageReportResolution | null
    resolutionReason: string | null
    createdAt: Date
  }>
): Promise<MessageReportRow[]> {
  const flatIds = [...new Set(rows.map((r) => r.flatMessageId).filter((v): v is string => !!v))]
  const caseIds = [...new Set(rows.map((r) => r.caseMessageId).filter((v): v is string => !!v))]

  const [flatRows, caseRows] = await Promise.all([
    flatIds.length
      ? db.select({ id: messages.id, senderId: messages.senderId }).from(messages).where(inArray(messages.id, flatIds))
      : Promise.resolve([] as Array<{ id: string; senderId: string }>),
    caseIds.length
      ? db
          .select({ id: escrowCaseMessage.id, senderId: escrowCaseMessage.senderId })
          .from(escrowCaseMessage)
          .where(inArray(escrowCaseMessage.id, caseIds))
      : Promise.resolve([] as Array<{ id: string; senderId: string | null }>),
  ])
  const senderByFlatId = new Map(flatRows.map((r) => [r.id, r.senderId]))
  const senderByCaseMessageId = new Map(caseRows.map((r) => [r.id, r.senderId]))

  const senderIds = [
    ...new Set([...flatRows.map((r) => r.senderId), ...caseRows.map((r) => r.senderId).filter((v): v is string => !!v)]),
  ]
  const senders = senderIds.length
    ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, senderIds))
    : []
  const senderNameById = new Map(senders.map((s) => [s.id, s.name]))

  return rows.map((r) => {
    const senderId = r.flatMessageId
      ? senderByFlatId.get(r.flatMessageId) ?? null
      : r.caseMessageId
        ? senderByCaseMessageId.get(r.caseMessageId) ?? null
        : null
    return {
      ...r,
      senderId,
      senderName: senderId ? senderNameById.get(senderId) ?? null : null,
    }
  })
}

export class MessageReportNotFoundError extends Error {
  constructor(id: string) {
    super(`Message report ${id} not found`)
    this.name = "MessageReportNotFoundError"
  }
}

export class MessageReportAlreadyResolvedError extends Error {
  constructor(id: string) {
    super(`Message report ${id} was already resolved`)
    this.name = "MessageReportAlreadyResolvedError"
  }
}

/**
 * Resolves a report with one of the five actions from the brief. `mute_user`/
 * `ban_user` also issue the actual restriction (against the reported message's
 * sender, not the reporter); `delete_message` performs a real hard delete on the
 * underlying flat/case message, matching how the flat table already treats
 * deletion (no soft-delete column exists — see message_report's contentSnapshot).
 * Every branch writes the resolution row and (for mute/ban) the restriction's own
 * audit row; a `report_actioned`/`report_dismissed` audit row is always written.
 */
export async function resolveMessageReport(params: {
  reportId: string
  action: MessageReportResolution
  reason: string
  resolvedByAdminId: string
}): Promise<void> {
  const [report] = await db.select().from(messageReport).where(eq(messageReport.id, params.reportId)).limit(1)
  if (!report) throw new MessageReportNotFoundError(params.reportId)
  if (report.status !== "open") throw new MessageReportAlreadyResolvedError(params.reportId)

  let targetSenderId: string | null = null
  if (params.action === "mute_user" || params.action === "ban_user") {
    if (report.flatMessageId) {
      const [row] = await db.select({ senderId: messages.senderId }).from(messages).where(eq(messages.id, report.flatMessageId)).limit(1)
      targetSenderId = row?.senderId ?? null
    } else if (report.caseMessageId) {
      const [row] = await db
        .select({ senderId: escrowCaseMessage.senderId })
        .from(escrowCaseMessage)
        .where(eq(escrowCaseMessage.id, report.caseMessageId))
        .limit(1)
      targetSenderId = row?.senderId ?? null
    }
    if (!targetSenderId) throw new Error("Cannot mute/ban: the reported message's sender no longer exists")
  }

  await db.transaction(async (tx) => {
    await tx
      .update(messageReport)
      .set({
        status: params.action === "dismiss" ? "dismissed" : "actioned",
        resolvedAt: new Date(),
        resolvedByAdminId: params.resolvedByAdminId,
        resolutionAction: params.action,
        resolutionReason: params.reason,
      })
      .where(eq(messageReport.id, params.reportId))

    if (params.action === "delete_message") {
      if (report.flatMessageId) {
        await tx.delete(messages).where(eq(messages.id, report.flatMessageId))
      } else if (report.caseMessageId) {
        await tx.delete(escrowCaseMessage).where(eq(escrowCaseMessage.id, report.caseMessageId))
      }
    }

    await tx.insert(escrowChatAuditLog).values({
      actorId: params.resolvedByAdminId,
      actionType: params.action === "dismiss" ? "report_dismissed" : "report_actioned",
      targetType: "report",
      targetId: params.reportId,
      afterState: { action: params.action },
      reason: params.reason,
    })
  })

  // Mute/ban run as their own transaction (issueRestriction already wraps one) —
  // sequenced after the report is marked resolved so a restriction failure never
  // leaves the report silently un-actioned; it also means a retry after a failed
  // mute/ban would hit MessageReportAlreadyResolvedError, which is surfaced as a
  // clear "already resolved, restriction failed — issue it manually" case rather
  // than a confusing double-action.
  if (params.action === "mute_user" && targetSenderId) {
    await issueRestriction({
      userId: targetSenderId,
      restrictionType: "mute",
      reason: params.reason,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      issuedByAdminId: params.resolvedByAdminId,
    })
  } else if (params.action === "ban_user" && targetSenderId) {
    await issueRestriction({
      userId: targetSenderId,
      restrictionType: "ban",
      reason: params.reason,
      expiresAt: null,
      issuedByAdminId: params.resolvedByAdminId,
    })
  }
}

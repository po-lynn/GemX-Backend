// Real-data queries backing the Messages triage inbox (app/admin/messages).
// See docs/technical/messages-triage.md for what's still missing at the
// schema level (conversation type/status/assignment/notes/audit log) — this
// module fills in only what's genuinely representable with the existing
// `messages` table today.

import { desc, eq, inArray } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { messages } from "@/drizzle/schema/chat-schema"
import type { ConversationType, TriageConversation, TriageMessage } from "@/features/messages/types/triage"

const senderUser = alias(user, "triage_sender")
const recipientUser = alias(user, "triage_recipient")

// TEMPORARY heuristic pending a real `type` column set at message-send time
// (see docs/technical/messages-triage.md's "Known gaps" section — the user
// explicitly asked for a real column over inferring from text long-term).
// Escrow requests are identified today by a fixed body prefix used by the
// escrow-request send path. "Contact Us" isn't representable at all yet —
// contactMessage is a separate, unrelated table (anonymous website
// submissions) never linked to this messages table, so it never surfaces
// here until that integration is built.
export function classifyType(content: string, senderRole: string): ConversationType {
  if (/^Escrow service request/i.test(content.trim())) return "escrow"
  if (senderRole === "admin") return "system"
  return "chat"
}

/** Stable, order-independent id for a 1:1 pair — mirrors the SQL pair_key convention in admin-all-conversations.ts. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

export function splitPairKey(id: string): [string, string] {
  const [a, b] = id.split(":")
  return [a, b]
}

function toIso(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString()
}

export async function getTriageMessagesFromDb(): Promise<TriageMessage[]> {
  const rows = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      senderName: senderUser.name,
      recipientName: recipientUser.name,
      senderRole: senderUser.role,
      content: messages.content,
      starred: messages.starred,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .leftJoin(senderUser, eq(senderUser.id, messages.senderId))
    .leftJoin(recipientUser, eq(recipientUser.id, messages.recipientId))
    .orderBy(desc(messages.createdAt))

  return rows.map((r) => ({
    id: r.id,
    conversationId: pairKey(r.senderId, r.recipientId),
    from: { id: r.senderId, name: r.senderName ?? "Unknown user" },
    to: { id: r.recipientId, name: r.recipientName ?? "Unknown user" },
    body: r.content,
    sentAt: toIso(r.createdAt),
    type: classifyType(r.content, r.senderRole ?? ""),
    flagged: !!r.starred,
    awaitingReply: false,
    assignedToMe: false,
    resolved: false,
  }))
}

type PairAggRow = {
  pair_key: string
  sender_id: string
  recipient_id: string
  content: string
  created_at: Date | string
  message_count: number
  any_flagged: boolean
}

/** Every 1:1 conversation in the system, one row per pair, most-recently-active first.
 *  Not paginated yet — see README's "must paginate or virtualize" note; capped at 500
 *  for now, which comfortably covers current data volume. */
export async function getTriageConversationsFromDb(): Promise<TriageConversation[]> {
  const result = await db.execute(sql`
    WITH pairs AS (
      SELECT
        LEAST(sender_id, recipient_id) || ':' || GREATEST(sender_id, recipient_id) AS pair_key,
        sender_id, recipient_id, content, starred, created_at
      FROM messages
    ),
    latest AS (
      SELECT DISTINCT ON (pair_key) pair_key, sender_id, recipient_id, content, created_at
      FROM pairs
      ORDER BY pair_key, created_at DESC
    ),
    agg AS (
      SELECT pair_key, count(*)::int AS message_count, bool_or(starred) AS any_flagged
      FROM pairs
      GROUP BY pair_key
    )
    SELECT latest.pair_key, latest.sender_id, latest.recipient_id, latest.content,
           latest.created_at, agg.message_count, agg.any_flagged
    FROM latest JOIN agg USING (pair_key)
    ORDER BY latest.created_at DESC
    LIMIT 500
  `)
  const rows = [...result] as PairAggRow[]
  if (rows.length === 0) return []

  const userIds = [...new Set(rows.flatMap((r) => [r.sender_id, r.recipient_id]))]
  const profiles = await db
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(inArray(user.id, userIds))
  const profileById = new Map(profiles.map((p) => [p.id, p]))
  const fallback = { name: "Unknown user", role: "" }

  return rows.map((r) => {
    const senderProfile = profileById.get(r.sender_id) ?? fallback
    return {
      id: r.pair_key,
      participantA: { id: r.sender_id, name: senderProfile.name },
      participantB: { id: r.recipient_id, name: (profileById.get(r.recipient_id) ?? fallback).name },
      type: classifyType(r.content, senderProfile.role),
      lastMessagePreview: r.content,
      lastMessageAt: toIso(r.created_at),
      messageCount: r.message_count,
      flagged: !!r.any_flagged,
      awaitingReply: false,
      assignedToMe: false,
      resolved: false,
    }
  })
}

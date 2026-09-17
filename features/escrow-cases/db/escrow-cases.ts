import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { escrowCase, escrowCaseMessage, type escrowCaseStateEnum } from "@/drizzle/schema/escrow-case-schema"
import { escrowServiceSetting } from "@/drizzle/schema/escrow-service-setting-schema"
import { escrowChatAuditLog } from "@/drizzle/schema/chat-moderation-schema"
import { user } from "@/drizzle/schema/auth-schema"
import { buildSystemMessageCopy } from "@/features/escrow-cases/lib/system-message-copy"

export type EscrowCaseState = (typeof escrowCaseStateEnum.enumValues)[number]

export type EscrowCaseRow = {
  id: string
  buyerId: string
  sellerId: string
  listingId: string
  assignedAgentId: string | null
  state: EscrowCaseState
}

export async function getEscrowCaseById(caseId: string): Promise<EscrowCaseRow | null> {
  const [row] = await db
    .select({
      id: escrowCase.id,
      buyerId: escrowCase.buyerId,
      sellerId: escrowCase.sellerId,
      listingId: escrowCase.listingId,
      assignedAgentId: escrowCase.assignedAgentId,
      state: escrowCase.state,
    })
    .from(escrowCase)
    .where(eq(escrowCase.id, caseId))
    .limit(1)
  return row ?? null
}

export type EscrowCaseParticipant = {
  id: string
  name: string
  image: string | null
}

export type EscrowCaseListItem = {
  id: string
  buyer: EscrowCaseParticipant
  seller: EscrowCaseParticipant
  listingId: string
  listingTitle: string | null
  assignedAgentId: string | null
  state: EscrowCaseState
  stateEnteredAt: string
  agreedPriceMinor: number
  currency: "USD" | "MMK"
  hasUnread: boolean
  lastMessageAt: string | null
}

type EscrowCaseListRow = {
  id: string
  listingId: string
  listingTitle: string | null
  assignedAgentId: string | null
  state: EscrowCaseState
  stateEnteredAt: Date | string
  agreedPriceMinor: string | number
  currency: "USD" | "MMK"
  buyerId: string
  buyerName: string
  buyerImage: string | null
  sellerId: string
  sellerName: string
  sellerImage: string | null
  lastMessageAt: Date | string | null
  hasUnread: boolean
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapListRow(row: EscrowCaseListRow): EscrowCaseListItem {
  return {
    id: row.id,
    buyer: { id: row.buyerId, name: row.buyerName, image: row.buyerImage },
    seller: { id: row.sellerId, name: row.sellerName, image: row.sellerImage },
    listingId: row.listingId,
    listingTitle: row.listingTitle,
    assignedAgentId: row.assignedAgentId,
    state: row.state,
    stateEnteredAt: toIso(row.stateEnteredAt),
    agreedPriceMinor: Number(row.agreedPriceMinor),
    currency: row.currency,
    hasUnread: row.hasUnread,
    lastMessageAt: row.lastMessageAt ? toIso(row.lastMessageAt) : null,
  }
}

export type EscrowCaseSearchParams = {
  /** Substring match against buyer name, seller name, and listing title (ILIKE, case-insensitive). */
  q?: string
  state?: EscrowCaseState
  /** Only cases with at least one open message_report against one of their case messages. */
  reportedOnly?: boolean
  /** Inclusive date-range filter on state_entered_at (the SLA-age clock). */
  dateFrom?: Date
  dateTo?: Date
}

/**
 * Case list for one viewer: unread-first (a case-thread message newer than the viewer's
 * own read cursor), then oldest state-entry first (SLA age) — mirrors the Queue Console's
 * "oldest unattended first" convention. `assignedAgentId` scopes to one agent's own cases
 * (the plain agent inbox); omit it for the supervisor/admin/moderation "all cases" view.
 *
 * `search` is real server-side filtering (item 1 of the brief's oversight scope:
 * "find threads by participant, listing, date range, reported status, or message
 * content") — replacing what used to be a pure client-side substring filter over the
 * full unfiltered list. Message-*content* search isn't included here (it would need
 * scanning escrow_case_message.content, a separate, heavier query); `q` covers
 * participant/listing, which is what the inbox's search box actually needs day to day.
 */
export async function listEscrowCasesForViewer(params: {
  viewerId: string
  assignedAgentId?: string
  search?: EscrowCaseSearchParams
}): Promise<EscrowCaseListItem[]> {
  const { viewerId, assignedAgentId, search } = params

  const conditions: ReturnType<typeof sql>[] = []
  if (assignedAgentId) conditions.push(sql`ec.assigned_agent_id = ${assignedAgentId}`)
  if (search?.q?.trim()) {
    const like = `%${search.q.trim()}%`
    conditions.push(sql`(buyer.name ILIKE ${like} OR seller.name ILIKE ${like} OR p.title ILIKE ${like})`)
  }
  if (search?.state) conditions.push(sql`ec.state = ${search.state}`)
  if (search?.dateFrom) conditions.push(sql`ec.state_entered_at >= ${search.dateFrom}`)
  if (search?.dateTo) conditions.push(sql`ec.state_entered_at <= ${search.dateTo}`)
  if (search?.reportedOnly) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM message_report mr
      JOIN escrow_case_message ecm ON ecm.id = mr.case_message_id
      WHERE ecm.case_id = ec.id AND mr.status = 'open'
    )`)
  }

  const whereClause = conditions.length
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``

  const result = await db.execute(sql`
    SELECT
      ec.id,
      ec.listing_id       AS "listingId",
      p.title              AS "listingTitle",
      ec.assigned_agent_id AS "assignedAgentId",
      ec.state,
      ec.state_entered_at AS "stateEnteredAt",
      ec.agreed_price_minor AS "agreedPriceMinor",
      ec.currency,
      ec.buyer_id  AS "buyerId",
      buyer.name   AS "buyerName",
      buyer.image  AS "buyerImage",
      ec.seller_id AS "sellerId",
      seller.name  AS "sellerName",
      seller.image AS "sellerImage",
      latest.last_message_at AS "lastMessageAt",
      (latest.last_message_at IS NOT NULL AND latest.last_message_at > COALESCE(rc.last_read_at, TIMESTAMP '-infinity')) AS "hasUnread"
    FROM escrow_case ec
    JOIN "user" buyer ON buyer.id = ec.buyer_id
    JOIN "user" seller ON seller.id = ec.seller_id
    LEFT JOIN product p ON p.id = ec.listing_id
    LEFT JOIN LATERAL (
      SELECT MAX(created_at) AS last_message_at
      FROM escrow_case_message
      WHERE case_id = ec.id AND visibility = 'case'
    ) latest ON true
    LEFT JOIN escrow_case_read_cursor rc ON rc.case_id = ec.id AND rc.user_id = ${viewerId}
    ${whereClause}
    ORDER BY "hasUnread" DESC, ec.state_entered_at ASC
  `)
  return [...result].map((row) => mapListRow(row as EscrowCaseListRow))
}

/**
 * Creates the minimum escrow case record needed to hang a case thread on — staff-initiated
 * from the admin panel (no mobile case-creation endpoint exists; see the brief's scope note).
 * Fee terms are snapshotted from the current escrow_service_setting row so an in-flight
 * case's fee never retroactively changes if the global config is edited later. Emits no
 * system message or audit row here — those are wired in alongside the state machine.
 */
/**
 * Creates the case, then atomically posts its opening system message (and, if an agent
 * was picked at creation time, an "assigned" system message + audit row too — creating
 * a case pre-assigned skips setEscrowCaseAgent, so this is the only place that path's
 * assignment would otherwise go unannounced).
 */
export async function createEscrowCase(input: {
  buyerId: string
  sellerId: string
  listingId: string
  assignedAgentId: string | null
  agreedPriceMinor: number
  currency: "USD" | "MMK"
  actorId: string
}): Promise<EscrowCaseRow> {
  const [settings] = await db
    .select({
      serviceFee: escrowServiceSetting.serviceFee,
      buyerFeeShareBps: escrowServiceSetting.buyerFeeShareBps,
      sellerFeeShareBps: escrowServiceSetting.sellerFeeShareBps,
      feeMinMinor: escrowServiceSetting.feeMinMinor,
      feeCapMinor: escrowServiceSetting.feeCapMinor,
    })
    .from(escrowServiceSetting)
    .orderBy(desc(escrowServiceSetting.updatedAt))
    .limit(1)

  // serviceFee is a percent (e.g. "2.50" = 2.5%) stored as numeric text; convert to bps.
  const feeBps = settings ? Math.round(Number(settings.serviceFee) * 100) : 0

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(escrowCase)
      .values({
        buyerId: input.buyerId,
        sellerId: input.sellerId,
        listingId: input.listingId,
        assignedAgentId: input.assignedAgentId,
        state: input.assignedAgentId ? "agent_assigned" : "requested",
        agreedPriceMinor: input.agreedPriceMinor,
        currency: input.currency,
        feeBps,
        buyerFeeShareBps: settings?.buyerFeeShareBps ?? 5000,
        sellerFeeShareBps: settings?.sellerFeeShareBps ?? 5000,
        feeMinMinor: settings?.feeMinMinor ?? null,
        feeCapMinor: settings?.feeCapMinor ?? null,
      })
      .returning({
        id: escrowCase.id,
        buyerId: escrowCase.buyerId,
        sellerId: escrowCase.sellerId,
        listingId: escrowCase.listingId,
        assignedAgentId: escrowCase.assignedAgentId,
        state: escrowCase.state,
      })
    if (!row) throw new Error("Failed to create escrow case")

    await tx.insert(escrowCaseMessage).values({
      caseId: row.id,
      senderId: null,
      kind: "system",
      visibility: "case",
      content: buildSystemMessageCopy("case_created", {}),
      systemEventType: "case_created",
      systemEventPayload: {},
    })

    if (input.assignedAgentId) {
      const [agent] = await tx.select({ name: user.name }).from(user).where(eq(user.id, input.assignedAgentId)).limit(1)
      const agentName = agent?.name ?? "the assigned agent"

      await tx.insert(escrowCaseMessage).values({
        caseId: row.id,
        senderId: null,
        kind: "system",
        visibility: "case",
        content: buildSystemMessageCopy("assigned", { agentName }),
        systemEventType: "assigned",
        systemEventPayload: { agentName },
      })

      await tx.insert(escrowChatAuditLog).values({
        actorId: input.actorId,
        actionType: "case_assigned",
        targetType: "escrow_case",
        targetId: row.id,
        beforeState: { assignedAgentId: null },
        afterState: { assignedAgentId: input.assignedAgentId },
      })
    }

    return row
  })
}

export type EscrowCaseDetail = EscrowCaseRow & {
  listingTitle: string | null
  agreedPriceMinor: number
  currency: "USD" | "MMK"
  feeBps: number
  buyerFeeShareBps: number
  sellerFeeShareBps: number
  feeMinMinor: number | null
  feeCapMinor: number | null
  stateEnteredAt: string
  nextActionNote: string | null
  buyer: EscrowCaseParticipant
  seller: EscrowCaseParticipant
  agentName: string | null
}

/** Full case context for the thread view's context panel. */
export async function getEscrowCaseDetail(caseId: string): Promise<EscrowCaseDetail | null> {
  const result = await db.execute(sql`
    SELECT
      ec.id, ec.buyer_id AS "buyerId", ec.seller_id AS "sellerId", ec.listing_id AS "listingId",
      ec.assigned_agent_id AS "assignedAgentId", ec.state, ec.state_entered_at AS "stateEnteredAt",
      ec.agreed_price_minor AS "agreedPriceMinor", ec.currency, ec.fee_bps AS "feeBps",
      ec.buyer_fee_share_bps AS "buyerFeeShareBps", ec.seller_fee_share_bps AS "sellerFeeShareBps",
      ec.fee_min_minor AS "feeMinMinor", ec.fee_cap_minor AS "feeCapMinor",
      ec.next_action_note AS "nextActionNote",
      p.title AS "listingTitle",
      buyer.name AS "buyerName", buyer.image AS "buyerImage",
      seller.name AS "sellerName", seller.image AS "sellerImage",
      agent.name AS "agentName"
    FROM escrow_case ec
    JOIN "user" buyer ON buyer.id = ec.buyer_id
    JOIN "user" seller ON seller.id = ec.seller_id
    LEFT JOIN product p ON p.id = ec.listing_id
    LEFT JOIN "user" agent ON agent.id = ec.assigned_agent_id
    WHERE ec.id = ${caseId}
    LIMIT 1
  `)
  const row = [...result][0] as
    | (EscrowCaseRow & {
        listingTitle: string | null
        stateEnteredAt: Date | string
        agreedPriceMinor: string | number
        currency: "USD" | "MMK"
        feeBps: number
        buyerFeeShareBps: number
        sellerFeeShareBps: number
        feeMinMinor: string | number | null
        feeCapMinor: string | number | null
        nextActionNote: string | null
        buyerName: string
        buyerImage: string | null
        sellerName: string
        sellerImage: string | null
        agentName: string | null
      })
    | undefined
  if (!row) return null

  return {
    id: row.id,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    listingId: row.listingId,
    assignedAgentId: row.assignedAgentId,
    agentName: row.agentName,
    state: row.state,
    listingTitle: row.listingTitle,
    agreedPriceMinor: Number(row.agreedPriceMinor),
    currency: row.currency as "USD" | "MMK",
    feeBps: row.feeBps,
    buyerFeeShareBps: row.buyerFeeShareBps,
    sellerFeeShareBps: row.sellerFeeShareBps,
    feeMinMinor: row.feeMinMinor == null ? null : Number(row.feeMinMinor),
    feeCapMinor: row.feeCapMinor == null ? null : Number(row.feeCapMinor),
    stateEnteredAt: toIso(row.stateEnteredAt),
    nextActionNote: row.nextActionNote,
    buyer: { id: row.buyerId, name: row.buyerName, image: row.buyerImage },
    seller: { id: row.sellerId, name: row.sellerName, image: row.sellerImage },
  }
}

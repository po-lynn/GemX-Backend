import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { escrowCase, type escrowCaseStateEnum } from "@/drizzle/schema/escrow-case-schema"
import { escrowServiceSetting } from "@/drizzle/schema/escrow-service-setting-schema"

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

/**
 * Case list for one viewer: unread-first (a case-thread message newer than the viewer's
 * own read cursor), then oldest state-entry first (SLA age) — mirrors the Queue Console's
 * "oldest unattended first" convention. `assignedAgentId` scopes to one agent's own cases
 * (the plain agent inbox); omit it for the supervisor/admin "all cases" view.
 */
export async function listEscrowCasesForViewer(params: {
  viewerId: string
  assignedAgentId?: string
}): Promise<EscrowCaseListItem[]> {
  const { viewerId, assignedAgentId } = params
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
    ${assignedAgentId ? sql`WHERE ec.assigned_agent_id = ${assignedAgentId}` : sql``}
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
export async function createEscrowCase(input: {
  buyerId: string
  sellerId: string
  listingId: string
  assignedAgentId: string | null
  agreedPriceMinor: number
  currency: "USD" | "MMK"
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

  const [row] = await db
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
  return row
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
      seller.name AS "sellerName", seller.image AS "sellerImage"
    FROM escrow_case ec
    JOIN "user" buyer ON buyer.id = ec.buyer_id
    JOIN "user" seller ON seller.id = ec.seller_id
    LEFT JOIN product p ON p.id = ec.listing_id
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
      })
    | undefined
  if (!row) return null

  return {
    id: row.id,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    listingId: row.listingId,
    assignedAgentId: row.assignedAgentId,
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

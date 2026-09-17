import { and, eq } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { escrowCase, escrowCaseMessage } from "@/drizzle/schema/escrow-case-schema"
import { escrowChatAuditLog } from "@/drizzle/schema/chat-moderation-schema"
import { assertValidTransition, type EscrowCaseState } from "@/features/escrow-cases/lib/state-machine"
import { buildSystemMessageCopy } from "@/features/escrow-cases/lib/system-message-copy"
import type { EscrowCaseRow } from "@/features/escrow-cases/db/escrow-cases"

export class EscrowCaseNotFoundError extends Error {
  constructor(caseId: string) {
    super(`Escrow case ${caseId} not found`)
    this.name = "EscrowCaseNotFoundError"
  }
}

/** Thrown when the row changed between the read and the conditional write inside the
 *  same transaction (someone else transitioned/assigned it concurrently). */
export class EscrowCaseConflictError extends Error {
  constructor(caseId: string) {
    super(`Escrow case ${caseId} was modified concurrently — reload and retry`)
    this.name = "EscrowCaseConflictError"
  }
}

/** A well-formed but disallowed request, distinct from EscrowCaseStateError (which
 *  reports the state machine rejecting a transition that WAS attempted) — this is
 *  rejected before the state machine is even consulted, so callers should map it to 400. */
export class EscrowCaseInvalidRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EscrowCaseInvalidRequestError"
  }
}

const CASE_ROW_COLUMNS = {
  id: escrowCase.id,
  buyerId: escrowCase.buyerId,
  sellerId: escrowCase.sellerId,
  listingId: escrowCase.listingId,
  assignedAgentId: escrowCase.assignedAgentId,
  state: escrowCase.state,
}

/**
 * Server-enforced state transition, atomically paired with its system message and audit
 * row (item 5 of the state-machine design: "posts a system message, hands the thread
 * over, keeps history" applies here too). The conditional UPDATE (`WHERE state =
 * <the state we read>`) is this repo's existing optimistic-concurrency pattern (see
 * features/points/db/points.ts) rather than an explicit row lock.
 *
 * "agent_assigned" can only be entered via assignEscrowCaseAgent below — that transition
 * inherently means "an agent was just assigned," so driving it through this generic
 * endpoint would let a case reach agent_assigned with assignedAgentId still null.
 */
export async function transitionEscrowCaseState(params: {
  caseId: string
  toState: EscrowCaseState
  actorId: string
  reason?: string
}): Promise<EscrowCaseRow> {
  if (params.toState === "agent_assigned") {
    throw new EscrowCaseInvalidRequestError('Use assignEscrowCaseAgent to transition into "agent_assigned"')
  }

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ state: escrowCase.state })
      .from(escrowCase)
      .where(eq(escrowCase.id, params.caseId))
      .limit(1)
    if (!current) throw new EscrowCaseNotFoundError(params.caseId)

    assertValidTransition(current.state, params.toState)

    const [updated] = await tx
      .update(escrowCase)
      .set({ state: params.toState, stateEnteredAt: new Date() })
      .where(and(eq(escrowCase.id, params.caseId), eq(escrowCase.state, current.state)))
      .returning(CASE_ROW_COLUMNS)
    if (!updated) throw new EscrowCaseConflictError(params.caseId)

    await tx.insert(escrowCaseMessage).values({
      caseId: params.caseId,
      senderId: null,
      kind: "system",
      visibility: "case",
      content: buildSystemMessageCopy("state_changed", { from: current.state, to: params.toState }),
      systemEventType: "state_changed",
      systemEventPayload: { from: current.state, to: params.toState },
    })

    await tx.insert(escrowChatAuditLog).values({
      actorId: params.actorId,
      actionType: "state_changed",
      targetType: "escrow_case",
      targetId: params.caseId,
      beforeState: { state: current.state },
      afterState: { state: params.toState },
      reason: params.reason ?? null,
    })

    return updated
  })
}

/**
 * Assigns or reassigns the case's agent — the same function handles both (item 8:
 * "Reassignment — posts a system message, hands the thread over, keeps history"), since
 * the only difference is which system event/audit action fires and whether the case
 * also advances out of "requested". A first assignment (assignedAgentId was null) also
 * transitions requested -> agent_assigned; a reassignment (already assigned) leaves the
 * current state untouched — it's a mid-flow handover, not a fresh start.
 */
export async function setEscrowCaseAgent(params: {
  caseId: string
  agentId: string
  agentName: string
  actorId: string
  previousAgentName: string | null
}): Promise<EscrowCaseRow> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ assignedAgentId: escrowCase.assignedAgentId, state: escrowCase.state })
      .from(escrowCase)
      .where(eq(escrowCase.id, params.caseId))
      .limit(1)
    if (!current) throw new EscrowCaseNotFoundError(params.caseId)

    if (current.assignedAgentId === params.agentId) {
      throw new EscrowCaseInvalidRequestError("Case is already assigned to this agent")
    }

    const isFirstAssignment = current.assignedAgentId === null
    const nextState = isFirstAssignment && current.state === "requested" ? "agent_assigned" : current.state

    const [updated] = await tx
      .update(escrowCase)
      .set({
        assignedAgentId: params.agentId,
        state: nextState,
        stateEnteredAt: nextState !== current.state ? new Date() : undefined,
      })
      .where(and(eq(escrowCase.id, params.caseId), eq(escrowCase.state, current.state)))
      .returning(CASE_ROW_COLUMNS)
    if (!updated) throw new EscrowCaseConflictError(params.caseId)

    const eventType = isFirstAssignment ? "assigned" : "reassigned"
    const payload = isFirstAssignment
      ? { agentName: params.agentName }
      : { fromAgentName: params.previousAgentName, toAgentName: params.agentName }

    await tx.insert(escrowCaseMessage).values({
      caseId: params.caseId,
      senderId: null,
      kind: "system",
      visibility: "case",
      content: buildSystemMessageCopy(eventType, payload),
      systemEventType: eventType,
      systemEventPayload: payload,
    })

    await tx.insert(escrowChatAuditLog).values({
      actorId: params.actorId,
      actionType: isFirstAssignment ? "case_assigned" : "case_reassigned",
      targetType: "escrow_case",
      targetId: params.caseId,
      beforeState: { assignedAgentId: current.assignedAgentId },
      afterState: { assignedAgentId: params.agentId },
    })

    return updated
  })
}

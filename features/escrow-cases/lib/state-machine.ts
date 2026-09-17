import type { escrowCaseStateEnum } from "@/drizzle/schema/escrow-case-schema"

export type EscrowCaseState = (typeof escrowCaseStateEnum.enumValues)[number]

export class EscrowCaseStateError extends Error {
  constructor(
    public readonly from: EscrowCaseState,
    public readonly to: EscrowCaseState
  ) {
    super(`Cannot transition escrow case from "${from}" to "${to}"`)
    this.name = "EscrowCaseStateError"
  }
}

/** The happy-path lifecycle, in order. */
const LINEAR_PATH: EscrowCaseState[] = [
  "requested",
  "agent_assigned",
  "verification",
  "payment_pending",
  "handover_scheduled",
  "handover_confirmed",
  "completed",
]

/** Off-ramps reachable from any in-flight (non-terminal) state. */
const OFF_RAMPS: EscrowCaseState[] = ["cancelled", "rejected", "disputed"]

/**
 * Terminal states have no outgoing transitions. `disputed` is treated as terminal for
 * this MVP (the brief doesn't specify whether a disputed case can resume) — flagged as
 * an assumption, not a hard requirement; resuming from `disputed` would need its own
 * explicit rule here, not an ad hoc exception elsewhere.
 */
const TERMINAL_STATES = new Set<EscrowCaseState>(["completed", "cancelled", "rejected", "disputed"])

function buildTransitionTable(): Record<EscrowCaseState, EscrowCaseState[]> {
  const table = {} as Record<EscrowCaseState, EscrowCaseState[]>
  for (const state of [...LINEAR_PATH, ...OFF_RAMPS]) {
    table[state] = []
  }
  for (let i = 0; i < LINEAR_PATH.length - 1; i++) {
    const from = LINEAR_PATH[i]
    const to = LINEAR_PATH[i + 1]
    if (!TERMINAL_STATES.has(from)) table[from].push(to)
  }
  for (const from of LINEAR_PATH) {
    if (TERMINAL_STATES.has(from)) continue
    table[from].push(...OFF_RAMPS)
  }
  return table
}

const TRANSITION_TABLE = buildTransitionTable()

export function canTransition(from: EscrowCaseState, to: EscrowCaseState): boolean {
  return TRANSITION_TABLE[from]?.includes(to) ?? false
}

export function assertValidTransition(from: EscrowCaseState, to: EscrowCaseState): void {
  if (!canTransition(from, to)) throw new EscrowCaseStateError(from, to)
}

export function isTerminalState(state: EscrowCaseState): boolean {
  return TERMINAL_STATES.has(state)
}

/** Every state reachable in one step from `from` — drives the UI's transition picker
 *  (excludes "agent_assigned", which is only ever reached via the assign endpoint). */
export function getValidNextStates(from: EscrowCaseState): EscrowCaseState[] {
  return (TRANSITION_TABLE[from] ?? []).filter((state) => state !== "agent_assigned")
}

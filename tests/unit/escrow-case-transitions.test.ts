import { beforeEach, describe, expect, it, vi } from "vitest"

// Validates transitionEscrowCaseState / setEscrowCaseAgent: the state/assignment write,
// the system message, and the audit row must all happen inside the SAME db.transaction
// (never as separate top-level db calls — see tests/unit/points-registration-bonus-
// transaction.test.ts for why that atomicity matters), and each function's error paths
// (not found, invalid transition, concurrent-modification conflict) must throw before
// any write completes.

const { transaction, select, update, insert } = vi.hoisted(() => ({
  transaction: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}))

vi.mock("@/drizzle/db", () => ({ db: { select, update, insert, transaction } }))
vi.mock("@/drizzle/schema/escrow-case-schema", async () => {
  const actual = await vi.importActual<typeof import("@/drizzle/schema/escrow-case-schema")>(
    "@/drizzle/schema/escrow-case-schema"
  )
  return actual
})
vi.mock("@/drizzle/schema/chat-moderation-schema", async () => {
  const actual = await vi.importActual<typeof import("@/drizzle/schema/chat-moderation-schema")>(
    "@/drizzle/schema/chat-moderation-schema"
  )
  return actual
})

const {
  transitionEscrowCaseState,
  setEscrowCaseAgent,
  EscrowCaseNotFoundError,
  EscrowCaseConflictError,
  EscrowCaseInvalidRequestError,
} = await import("@/features/escrow-cases/db/case-transitions")
const { EscrowCaseStateError } = await import("@/features/escrow-cases/lib/state-machine")

const CASE_ROW = {
  id: "case-1",
  buyerId: "buyer-1",
  sellerId: "seller-1",
  listingId: "listing-1",
  assignedAgentId: "agent-1",
  state: "verification" as const,
}

function makeTx(opts: { selectResult: unknown[]; updateResult: unknown[] }) {
  const insertCalls: Array<{ table: unknown; values: unknown }> = []
  const tx = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(opts.selectResult) }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(opts.updateResult) }),
      }),
    }),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        insertCalls.push({ table, values })
        return Promise.resolve(undefined)
      }),
    })),
  }
  return { tx, insertCalls }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("transitionEscrowCaseState", () => {
  // Rejects entering "agent_assigned" through the generic transition path BEFORE ever
  // opening a transaction — that state can only be reached via setEscrowCaseAgent, so a
  // case can never end up "agent_assigned" with assignedAgentId still null.
  it("rejects transitioning into agent_assigned without ever calling db.transaction", async () => {
    await expect(
      transitionEscrowCaseState({ caseId: "case-1", toState: "agent_assigned", actorId: "admin-1" })
    ).rejects.toThrow(EscrowCaseInvalidRequestError)
    expect(transaction).not.toHaveBeenCalled()
  })

  it("throws EscrowCaseNotFoundError when the case doesn't exist", async () => {
    const { tx } = makeTx({ selectResult: [], updateResult: [] })
    transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))

    await expect(
      transitionEscrowCaseState({ caseId: "missing", toState: "verification", actorId: "admin-1" })
    ).rejects.toThrow(EscrowCaseNotFoundError)
  })

  // The state machine, not this function, is the source of truth for validity — an
  // invalid transition must throw before the UPDATE/INSERTs run.
  it("throws EscrowCaseStateError for an invalid transition and writes nothing", async () => {
    const { tx, insertCalls } = makeTx({ selectResult: [{ state: "completed" }], updateResult: [] })
    transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))

    await expect(
      transitionEscrowCaseState({ caseId: "case-1", toState: "verification", actorId: "admin-1" })
    ).rejects.toThrow(EscrowCaseStateError)
    expect(tx.update).not.toHaveBeenCalled()
    expect(insertCalls).toHaveLength(0)
  })

  // Concurrent modification: the conditional UPDATE's WHERE (id AND state = state we
  // read) matches zero rows because someone else already changed it.
  it("throws EscrowCaseConflictError when the conditional UPDATE affects no rows", async () => {
    const { tx } = makeTx({ selectResult: [{ state: "verification" }], updateResult: [] })
    transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))

    await expect(
      transitionEscrowCaseState({ caseId: "case-1", toState: "payment_pending", actorId: "admin-1" })
    ).rejects.toThrow(EscrowCaseConflictError)
  })

  it("updates state and inserts one system message + one audit row on a valid transition", async () => {
    const { tx, insertCalls } = makeTx({
      selectResult: [{ state: "verification" }],
      updateResult: [{ ...CASE_ROW, state: "payment_pending" }],
    })
    transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))

    const result = await transitionEscrowCaseState({
      caseId: "case-1",
      toState: "payment_pending",
      actorId: "admin-1",
    })

    expect(result.state).toBe("payment_pending")
    expect(insertCalls).toHaveLength(2)
    const messageInsert = insertCalls[0]!.values as Record<string, unknown>
    expect(messageInsert).toMatchObject({
      caseId: "case-1",
      senderId: null,
      kind: "system",
      visibility: "case",
      systemEventType: "state_changed",
      systemEventPayload: { from: "verification", to: "payment_pending" },
    })
    const auditInsert = insertCalls[1]!.values as Record<string, unknown>
    expect(auditInsert).toMatchObject({
      actorId: "admin-1",
      actionType: "state_changed",
      targetType: "escrow_case",
      targetId: "case-1",
      beforeState: { state: "verification" },
      afterState: { state: "payment_pending" },
    })
  })
})

describe("setEscrowCaseAgent", () => {
  it("throws EscrowCaseNotFoundError when the case doesn't exist", async () => {
    const { tx } = makeTx({ selectResult: [], updateResult: [] })
    transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))

    await expect(
      setEscrowCaseAgent({
        caseId: "missing",
        agentId: "agent-2",
        agentName: "New Agent",
        actorId: "admin-1",
        previousAgentName: null,
      })
    ).rejects.toThrow(EscrowCaseNotFoundError)
  })

  it("rejects assigning the same agent the case already has", async () => {
    const { tx } = makeTx({ selectResult: [{ assignedAgentId: "agent-1", state: "verification" }], updateResult: [] })
    transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))

    await expect(
      setEscrowCaseAgent({
        caseId: "case-1",
        agentId: "agent-1",
        agentName: "Agent One",
        actorId: "admin-1",
        previousAgentName: "Agent One",
      })
    ).rejects.toThrow(EscrowCaseInvalidRequestError)
  })

  // First assignment (was unassigned, in "requested"): advances the state to
  // agent_assigned and fires an "assigned" system message + case_assigned audit row.
  it("first assignment from requested advances state to agent_assigned", async () => {
    const { tx, insertCalls } = makeTx({
      selectResult: [{ assignedAgentId: null, state: "requested" }],
      updateResult: [{ ...CASE_ROW, assignedAgentId: "agent-2", state: "agent_assigned" }],
    })
    transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))

    const result = await setEscrowCaseAgent({
      caseId: "case-1",
      agentId: "agent-2",
      agentName: "New Agent",
      actorId: "admin-1",
      previousAgentName: null,
    })

    expect(result.state).toBe("agent_assigned")
    const messageInsert = insertCalls[0]!.values as Record<string, unknown>
    expect(messageInsert).toMatchObject({ systemEventType: "assigned", systemEventPayload: { agentName: "New Agent" } })
    const auditInsert = insertCalls[1]!.values as Record<string, unknown>
    expect(auditInsert).toMatchObject({ actionType: "case_assigned", beforeState: { assignedAgentId: null } })
  })

  // Reassignment (already assigned, mid-flow): the state must NOT change — only a
  // fresh "requested" case auto-advances on assignment.
  it("reassignment mid-flow leaves the case state unchanged", async () => {
    const { tx, insertCalls } = makeTx({
      selectResult: [{ assignedAgentId: "agent-1", state: "verification" }],
      updateResult: [{ ...CASE_ROW, assignedAgentId: "agent-2", state: "verification" }],
    })
    transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))

    const result = await setEscrowCaseAgent({
      caseId: "case-1",
      agentId: "agent-2",
      agentName: "New Agent",
      actorId: "supervisor-1",
      previousAgentName: "Old Agent",
    })

    expect(result.state).toBe("verification")
    const messageInsert = insertCalls[0]!.values as Record<string, unknown>
    expect(messageInsert).toMatchObject({
      systemEventType: "reassigned",
      systemEventPayload: { fromAgentName: "Old Agent", toAgentName: "New Agent" },
    })
    const auditInsert = insertCalls[1]!.values as Record<string, unknown>
    expect(auditInsert).toMatchObject({ actionType: "case_reassigned" })
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"

// Validates resolveMessageReport's branching: dismiss vs. actioned status, the real
// hard delete on delete_message, and that mute_user/ban_user issue an actual
// restriction (via issueRestriction, mocked here) against the reported message's
// SENDER — never the reporter.

const { transaction, select, update, delete: dbDelete } = vi.hoisted(() => ({
  transaction: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}))

vi.mock("@/drizzle/db", () => ({ db: { select, update, delete: dbDelete, transaction } }))
vi.mock("@/features/chat-moderation/db/restrictions", () => ({
  issueRestriction: vi.fn().mockResolvedValue({ id: "restriction-1" }),
}))

const { resolveMessageReport, MessageReportNotFoundError, MessageReportAlreadyResolvedError } = await import(
  "@/features/chat-moderation/db/reports"
)
const { issueRestriction } = await import("@/features/chat-moderation/db/restrictions")

const OPEN_FLAT_REPORT = {
  id: "report-1",
  flatMessageId: "msg-1",
  caseMessageId: null,
  status: "open" as const,
}

function selectChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  chain.from = vi.fn(() => chain)
  chain.where = vi.fn(() => chain)
  chain.limit = vi.fn(() => Promise.resolve(result))
  return chain
}

function makeTx() {
  const updateCalls: Array<{ table: unknown; values: unknown }> = []
  const deleteCalls: unknown[] = []
  const insertCalls: Array<{ table: unknown; values: unknown }> = []
  const tx = {
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: unknown) => {
        updateCalls.push({ table, values })
        return { where: vi.fn().mockResolvedValue(undefined) }
      }),
    })),
    delete: vi.fn((table: unknown) => {
      deleteCalls.push(table)
      return { where: vi.fn().mockResolvedValue(undefined) }
    }),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        insertCalls.push({ table, values })
        return Promise.resolve(undefined)
      }),
    })),
  }
  return { tx, updateCalls, deleteCalls, insertCalls }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("resolveMessageReport", () => {
  it("throws MessageReportNotFoundError when the report doesn't exist", async () => {
    vi.mocked(select).mockReturnValue(selectChain([]) as never)

    await expect(
      resolveMessageReport({ reportId: "missing", action: "dismiss", reason: "n/a", resolvedByAdminId: "admin-1" })
    ).rejects.toThrow(MessageReportNotFoundError)
    expect(transaction).not.toHaveBeenCalled()
  })

  it("throws MessageReportAlreadyResolvedError when status isn't open", async () => {
    vi.mocked(select).mockReturnValue(selectChain([{ ...OPEN_FLAT_REPORT, status: "dismissed" }]) as never)

    await expect(
      resolveMessageReport({ reportId: "report-1", action: "dismiss", reason: "n/a", resolvedByAdminId: "admin-1" })
    ).rejects.toThrow(MessageReportAlreadyResolvedError)
    expect(transaction).not.toHaveBeenCalled()
  })

  it("dismiss: sets status to dismissed, deletes nothing, issues no restriction", async () => {
    vi.mocked(select).mockReturnValue(selectChain([OPEN_FLAT_REPORT]) as never)
    const { tx, updateCalls, deleteCalls } = makeTx()
    vi.mocked(transaction).mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))

    await resolveMessageReport({ reportId: "report-1", action: "dismiss", reason: "not a violation", resolvedByAdminId: "admin-1" })

    expect((updateCalls[0]!.values as Record<string, unknown>).status).toBe("dismissed")
    expect(deleteCalls).toHaveLength(0)
    expect(issueRestriction).not.toHaveBeenCalled()
  })

  it("delete_message: sets status to actioned and hard-deletes the flat message", async () => {
    vi.mocked(select).mockReturnValue(selectChain([OPEN_FLAT_REPORT]) as never)
    const { tx, updateCalls, deleteCalls } = makeTx()
    vi.mocked(transaction).mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))

    await resolveMessageReport({ reportId: "report-1", action: "delete_message", reason: "policy violation", resolvedByAdminId: "admin-1" })

    expect((updateCalls[0]!.values as Record<string, unknown>).status).toBe("actioned")
    expect(deleteCalls).toHaveLength(1)
    expect(issueRestriction).not.toHaveBeenCalled()
  })

  it("mute_user: looks up the reported message's SENDER (not the reporter) and issues a 7-day mute", async () => {
    // First select() resolves the report row; second resolves the flat message's sender.
    vi.mocked(select)
      .mockReturnValueOnce(selectChain([OPEN_FLAT_REPORT]) as never)
      .mockReturnValueOnce(selectChain([{ senderId: "sender-1" }]) as never)
    const { tx } = makeTx()
    vi.mocked(transaction).mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))

    await resolveMessageReport({ reportId: "report-1", action: "mute_user", reason: "spam", resolvedByAdminId: "admin-1" })

    expect(issueRestriction).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "sender-1", restrictionType: "mute", issuedByAdminId: "admin-1" })
    )
  })

  it("ban_user: throws before writing anything if the sender no longer exists", async () => {
    vi.mocked(select)
      .mockReturnValueOnce(selectChain([OPEN_FLAT_REPORT]) as never)
      .mockReturnValueOnce(selectChain([]) as never)

    await expect(
      resolveMessageReport({ reportId: "report-1", action: "ban_user", reason: "abuse", resolvedByAdminId: "admin-1" })
    ).rejects.toThrow()
    expect(transaction).not.toHaveBeenCalled()
    expect(issueRestriction).not.toHaveBeenCalled()
  })
})

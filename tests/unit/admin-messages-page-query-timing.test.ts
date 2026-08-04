import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { connection } from "next/server"
import { requireMessagesAccess } from "@/features/messages/lib/require-messages-access"
import { getTriageConversationsFromDb, getTriageMessagesFromDb } from "@/features/messages/db/triage"
import { QueryTimeoutError } from "@/lib/query-timeout"
import AdminMessagesPage from "@/app/admin/messages/page"

// Regression test mirroring tests/unit/admin-products-page-query-timing.test.ts: this page
// used to fire both DB calls concurrently via Promise.all. Both the conversation list and
// the flat message list are primary — MessagesTriagePage's "mode" toggle renders one or the
// other as the page's actual content, so neither is a decorative enrichment of the other.
// Both run sequentially and throw on timeout, caught by error.tsx.

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/messages/lib/require-messages-access", () => ({
  requireMessagesAccess: vi.fn(),
}))
vi.mock("@/features/messages/db/triage", () => ({
  getTriageConversationsFromDb: vi.fn(),
  getTriageMessagesFromDb: vi.fn(),
}))
vi.mock("@/features/messages/components/triage/MessagesTriagePage", () => ({
  MessagesTriagePage: () => null,
}))
vi.mock("@/components/admin/motion", () => ({
  FadeUp: ({ children }: { children: React.ReactNode }) => children,
}))

describe("AdminMessagesPage query concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(requireMessagesAccess).mockResolvedValue({ user: { id: "admin-1" } } as never)
    vi.mocked(getTriageConversationsFromDb).mockResolvedValue([])
    vi.mocked(getTriageMessagesFromDb).mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Validates: the conversations query and messages query run one at a time (not
  // Promise.all), so the page never holds more than one pooler connection open at once.
  it("queries conversations, then messages — never concurrently", async () => {
    const order: string[] = []
    vi.mocked(getTriageConversationsFromDb).mockImplementation(async () => {
      order.push("conversations")
      return []
    })
    vi.mocked(getTriageMessagesFromDb).mockImplementation(async () => {
      order.push("messages")
      return []
    })

    await AdminMessagesPage()
    expect(order).toEqual(["conversations", "messages"])
  })

  // Validates: a hung conversations query causes the render to reject once the timeout
  // elapses, instead of hanging forever — Next.js turns this into the nearest error.tsx.
  it("rejects with QueryTimeoutError when the conversations query hangs past the timeout", async () => {
    vi.useFakeTimers()
    vi.mocked(getTriageConversationsFromDb).mockReturnValue(new Promise(() => {}))

    const pagePromise = AdminMessagesPage()
    const assertion = expect(pagePromise).rejects.toBeInstanceOf(QueryTimeoutError)
    await vi.advanceTimersByTimeAsync(6000)
    await assertion
  })

  // Validates: a hung messages query (the second, sequential call) also causes the render
  // to reject once its own timeout elapses.
  it("rejects with QueryTimeoutError when the messages query hangs past the timeout", async () => {
    vi.useFakeTimers()
    vi.mocked(getTriageMessagesFromDb).mockReturnValue(new Promise(() => {}))

    const pagePromise = AdminMessagesPage()
    const assertion = expect(pagePromise).rejects.toBeInstanceOf(QueryTimeoutError)
    await vi.advanceTimersByTimeAsync(6000)
    await assertion
  })
})

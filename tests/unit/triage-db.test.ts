// tests/unit/triage-db.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PgDialect } from "drizzle-orm/pg-core"

vi.mock("@/drizzle/db", () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
  },
}))

import { db } from "@/drizzle/db"
import {
  classifyType,
  getTriageConversationsFromDb,
  getTriageMessagesFromDb,
  pairKey,
  splitPairKey,
} from "@/features/messages/db/triage"

const dialect = new PgDialect()

describe("classifyType", () => {
  // Validates the TEMPORARY heuristic: a fixed body prefix marks escrow messages,
  // pending a real `type` column set at send time (see docs/technical/messages-triage.md).
  it("classifies a body starting with the escrow-request prefix as escrow, case-insensitively", () => {
    expect(classifyType("Escrow service request (buyer) for: Ring", "user")).toBe("escrow")
    expect(classifyType("escrow SERVICE request from someone", "user")).toBe("escrow")
  })

  // Validates admin-sent messages (that aren't escrow requests) are classified as system/Contact Us.
  it("classifies non-escrow messages sent by an admin as system", () => {
    expect(classifyType("Your listing has been approved", "admin")).toBe("system")
  })

  // Validates the default bucket for ordinary buyer/seller chat.
  it("classifies everything else as chat", () => {
    expect(classifyType("Is this still available?", "user")).toBe("chat")
    expect(classifyType("Is this still available?", "")).toBe("chat")
  })
})

describe("pairKey / splitPairKey", () => {
  // Validates the pair key is order-independent, so (A,B) and (B,A) collapse to one id.
  it("produces the same key regardless of argument order", () => {
    expect(pairKey("user-a", "user-b")).toBe(pairKey("user-b", "user-a"))
  })

  // Validates round-tripping through split recovers both original ids (in sorted order).
  it("splits back into the two original ids", () => {
    const key = pairKey("zzz", "aaa")
    expect(splitPairKey(key)).toEqual(["aaa", "zzz"])
  })
})

describe("getTriageConversationsFromDb", () => {
  beforeEach(() => vi.clearAllMocks())

  // Validates the pair-grouping query dedups (A,B)/(B,A) via LEAST/GREATEST, same
  // convention as getAllConversationsForAdmin, and aggregates count + any-flagged per pair.
  it("groups by LEAST/GREATEST pair key and aggregates message_count + any_flagged", async () => {
    vi.mocked(db.execute).mockResolvedValue([] as never)

    await getTriageConversationsFromDb()

    const sqlArg = vi.mocked(db.execute).mock.calls[0][0]
    const { sql: text } = dialect.sqlToQuery(sqlArg as never)
    expect(text).toContain("LEAST(sender_id, recipient_id)")
    expect(text).toContain("GREATEST(sender_id, recipient_id)")
    expect(text).toContain("count(*)::int AS message_count")
    expect(text).toContain("bool_or(starred) AS any_flagged")
  })

  // Validates the early-exit contract: no profile lookup when there are no conversations.
  it("returns [] without a profile lookup when there are no messages at all", async () => {
    vi.mocked(db.execute).mockResolvedValue([] as never)
    const result = await getTriageConversationsFromDb()
    expect(result).toEqual([])
    expect(db.select).not.toHaveBeenCalled()
  })

  // Validates row shaping: participants, heuristic type, and flagged/messageCount mapping,
  // with unknown profiles falling back gracefully instead of throwing.
  it("maps a pair row into a TriageConversation, classifying type from the last message", async () => {
    vi.mocked(db.execute).mockResolvedValue([
      {
        pair_key: "user-a:user-b",
        sender_id: "user-a",
        recipient_id: "user-b",
        content: "Escrow service request (buyer) for: Ring",
        created_at: new Date("2026-07-01T00:00:00.000Z"),
        message_count: 5,
        any_flagged: true,
      },
    ] as never)
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ id: "user-a", name: "Alice", role: "user" }]),
      }),
    } as never)

    const [row] = await getTriageConversationsFromDb()
    expect(row.id).toBe("user-a:user-b")
    expect(row.participantA).toEqual({ id: "user-a", name: "Alice" })
    expect(row.participantB).toEqual({ id: "user-b", name: "Unknown user" })
    expect(row.type).toBe("escrow")
    expect(row.messageCount).toBe(5)
    expect(row.flagged).toBe(true)
  })

  // Validates "awaiting reply": true only when a staff (admin/internal) account is one of
  // the two parties AND the *other*, non-staff party sent the most recent message — i.e.
  // staff owes a response. This is what backs the FilterRails "Awaiting reply" count and
  // the ConversationList row indicator.
  it("marks awaitingReply true when the non-staff party sent the latest message to a staff participant", async () => {
    vi.mocked(db.execute).mockResolvedValue([
      {
        pair_key: "buyer-1:escrow-1",
        sender_id: "buyer-1",
        recipient_id: "escrow-1",
        content: "Escrow service request (buyer) for: Ring",
        created_at: new Date("2026-07-01T00:00:00.000Z"),
        message_count: 1,
        any_flagged: false,
      },
    ] as never)
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () =>
          Promise.resolve([
            { id: "buyer-1", name: "Buyer", role: "user" },
            { id: "escrow-1", name: "Escrow", role: "internal" },
          ]),
      }),
    } as never)

    const [row] = await getTriageConversationsFromDb()
    expect(row.awaitingReply).toBe(true)
  })

  it("marks awaitingReply false when staff already sent the latest message", async () => {
    vi.mocked(db.execute).mockResolvedValue([
      {
        pair_key: "buyer-1:escrow-1",
        sender_id: "escrow-1",
        recipient_id: "buyer-1",
        content: "Thanks, I'll take a look",
        created_at: new Date("2026-07-01T00:00:00.000Z"),
        message_count: 2,
        any_flagged: false,
      },
    ] as never)
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () =>
          Promise.resolve([
            { id: "buyer-1", name: "Buyer", role: "user" },
            { id: "escrow-1", name: "Escrow", role: "internal" },
          ]),
      }),
    } as never)

    const [row] = await getTriageConversationsFromDb()
    expect(row.awaitingReply).toBe(false)
  })

  it("marks awaitingReply false for a pure buyer<->seller pair with no staff participant", async () => {
    vi.mocked(db.execute).mockResolvedValue([
      {
        pair_key: "buyer-1:seller-1",
        sender_id: "buyer-1",
        recipient_id: "seller-1",
        content: "Is this still available?",
        created_at: new Date("2026-07-01T00:00:00.000Z"),
        message_count: 1,
        any_flagged: false,
      },
    ] as never)
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () =>
          Promise.resolve([
            { id: "buyer-1", name: "Buyer", role: "user" },
            { id: "seller-1", name: "Seller", role: "user" },
          ]),
      }),
    } as never)

    const [row] = await getTriageConversationsFromDb()
    expect(row.awaitingReply).toBe(false)
  })
})

describe("getTriageMessagesFromDb", () => {
  beforeEach(() => vi.clearAllMocks())

  // Same awaitingReply rule as conversations, but computed per-message from that
  // single row's own sender/recipient role (no "latest in pair" lookup needed).
  it("marks a message awaitingReply true only when a non-staff sender wrote to a staff recipient", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        leftJoin: () => ({
          leftJoin: () => ({
            orderBy: () =>
              Promise.resolve([
                {
                  id: "msg-1",
                  senderId: "buyer-1",
                  recipientId: "escrow-1",
                  senderName: "Buyer",
                  recipientName: "Escrow",
                  senderRole: "user",
                  recipientRole: "internal",
                  content: "Escrow service request (buyer) for: Ring",
                  starred: false,
                  createdAt: new Date("2026-07-01T00:00:00.000Z"),
                },
                {
                  id: "msg-2",
                  senderId: "escrow-1",
                  recipientId: "buyer-1",
                  senderName: "Escrow",
                  recipientName: "Buyer",
                  senderRole: "internal",
                  recipientRole: "user",
                  content: "On it, checking now.",
                  starred: false,
                  createdAt: new Date("2026-07-01T00:05:00.000Z"),
                },
              ]),
          }),
        }),
      }),
    } as never)

    const [inbound, outbound] = await getTriageMessagesFromDb()
    expect(inbound.awaitingReply).toBe(true)
    expect(outbound.awaitingReply).toBe(false)
  })
})

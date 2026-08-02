// tests/unit/triage-filters.test.ts
import { describe, it, expect } from "vitest"
import {
  computeFacetCounts,
  filterConversations,
  filterMessages,
  matchesStatus,
  matchesType,
  sortByTimestamp,
} from "@/features/messages/lib/triage-filters"
import type { TriageConversation, TriageMessage } from "@/features/messages/types/triage"

const participant = (id: string, name: string) => ({ id, name })

function makeConversation(overrides: Partial<TriageConversation> = {}): TriageConversation {
  return {
    id: "c1",
    participantA: participant("a", "Alice"),
    participantB: participant("b", "Bob"),
    type: "chat",
    lastMessagePreview: "hello there",
    lastMessageAt: "2026-07-01T00:00:00+06:30",
    messageCount: 1,
    flagged: false,
    awaitingReply: false,
    assignedToMe: false,
    resolved: false,
    ...overrides,
  }
}

function makeMessage(overrides: Partial<TriageMessage> = {}): TriageMessage {
  return {
    id: "m1",
    conversationId: "c1",
    from: participant("a", "Alice"),
    to: participant("b", "Bob"),
    body: "hello there",
    sentAt: "2026-07-01T00:00:00+06:30",
    type: "chat",
    flagged: false,
    awaitingReply: false,
    assignedToMe: false,
    resolved: false,
    ...overrides,
  }
}

describe("matchesStatus", () => {
  it("returns true for 'all' regardless of flags", () => {
    expect(matchesStatus(makeConversation(), "all")).toBe(true)
  })
  it("checks the matching boolean field per status", () => {
    expect(matchesStatus(makeConversation({ flagged: true }), "flagged")).toBe(true)
    expect(matchesStatus(makeConversation({ flagged: false }), "flagged")).toBe(false)
    expect(matchesStatus(makeConversation({ awaitingReply: true }), "awaiting")).toBe(true)
    expect(matchesStatus(makeConversation({ assignedToMe: true }), "mine")).toBe(true)
    expect(matchesStatus(makeConversation({ resolved: true }), "resolved")).toBe(true)
  })
})

describe("matchesType", () => {
  it("'all' matches every type", () => {
    expect(matchesType(makeConversation({ type: "escrow" }), "all")).toBe(true)
  })
  it("matches only the exact type otherwise", () => {
    expect(matchesType(makeConversation({ type: "escrow" }), "escrow")).toBe(true)
    expect(matchesType(makeConversation({ type: "escrow" }), "chat")).toBe(false)
  })
})

describe("filterConversations", () => {
  const rows = [
    makeConversation({ id: "c1", type: "chat", flagged: true, lastMessagePreview: "off-platform payment" }),
    makeConversation({ id: "c2", type: "escrow", awaitingReply: true, participantA: participant("x", "Ni") }),
    makeConversation({ id: "c3", type: "system", resolved: true }),
  ]

  it("filters by status AND type (both axes apply together)", () => {
    const result = filterConversations(rows, { status: "awaiting", type: "escrow", query: "" })
    expect(result.map((r) => r.id)).toEqual(["c2"])
  })

  it("'all'/'all' returns every row", () => {
    const result = filterConversations(rows, { status: "all", type: "all", query: "" })
    expect(result).toHaveLength(3)
  })

  it("search matches participant names, preview text, and tag case-insensitively", () => {
    expect(filterConversations(rows, { status: "all", type: "all", query: "OFF-PLATFORM" }).map((r) => r.id)).toEqual(["c1"])
    expect(filterConversations(rows, { status: "all", type: "all", query: "ni" }).map((r) => r.id)).toEqual(["c2"])
  })

  it("returns nothing when no row matches the query", () => {
    expect(filterConversations(rows, { status: "all", type: "all", query: "nonexistent" })).toHaveLength(0)
  })
})

describe("filterMessages", () => {
  const rows = [
    makeMessage({ id: "m1", sku: "RING-001", body: "let's talk price" }),
    makeMessage({ id: "m2", type: "escrow", sku: "EMERL-002" }),
  ]

  it("search matches on SKU", () => {
    expect(filterMessages(rows, { status: "all", type: "all", query: "emerl-002" }).map((r) => r.id)).toEqual(["m2"])
  })
})

describe("sortByTimestamp", () => {
  const rows = [
    makeConversation({ id: "old", lastMessageAt: "2026-01-01T00:00:00+06:30" }),
    makeConversation({ id: "new", lastMessageAt: "2026-06-01T00:00:00+06:30" }),
  ]

  it("sorts newest first when sortDesc is true", () => {
    const result = sortByTimestamp(rows, (r) => r.lastMessageAt, true)
    expect(result.map((r) => r.id)).toEqual(["new", "old"])
  })

  it("sorts oldest first when sortDesc is false", () => {
    const result = sortByTimestamp(rows, (r) => r.lastMessageAt, false)
    expect(result.map((r) => r.id)).toEqual(["old", "new"])
  })

  it("does not mutate the input array", () => {
    const copy = [...rows]
    sortByTimestamp(rows, (r) => r.lastMessageAt, true)
    expect(rows).toEqual(copy)
  })
})

describe("computeFacetCounts", () => {
  const conversations = [
    makeConversation({ id: "c1", type: "chat", flagged: true }),
    makeConversation({ id: "c2", type: "escrow", awaitingReply: true }),
    makeConversation({ id: "c3", type: "escrow", resolved: true }),
  ]

  it("status counts respect the active type filter but not the active status", () => {
    const facets = computeFacetCounts("conversations", conversations, [], { status: "flagged", type: "escrow", query: "" })
    // Only escrow rows are considered for every status bucket, including 'all'.
    expect(facets.status.all).toBe(2)
    expect(facets.status.awaiting).toBe(1)
    expect(facets.status.resolved).toBe(1)
    expect(facets.status.flagged).toBe(0)
  })

  it("type counts respect the active status filter but not the active type", () => {
    const facets = computeFacetCounts("conversations", conversations, [], { status: "resolved", type: "chat", query: "" })
    expect(facets.type.all).toBe(1)
    expect(facets.type.escrow).toBe(1)
    expect(facets.type.chat).toBe(0)
  })
})

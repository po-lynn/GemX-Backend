// Pure filter/sort/facet-count logic for the Messages triage inbox, kept
// separate from the components so it's unit-testable without rendering
// React. Also resolves the reading-pane thread for a conversation.
//
// When real data replaces the mock fixtures, filterConversations/
// filterMessages/computeFacetCounts should move server-side (query params on
// GET /admin/conversations, /admin/messages, /admin/messages/facets per the
// README) — this module can stay as the single source of truth for the
// matching rules so client and server agree.

import type {
  ConversationType,
  StatusFilter,
  TriageConversation,
  TriageFacetCounts,
  TriageMessage,
  TypeFilter,
} from "@/features/messages/types/triage"

export const STATUS_FILTERS: StatusFilter[] = ["all", "flagged", "awaiting", "mine", "resolved"]
export const TYPE_FILTERS: TypeFilter[] = ["all", "chat", "escrow", "system"]

export const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All statuses",
  flagged: "Flagged",
  awaiting: "Awaiting reply",
  mine: "Assigned to me",
  resolved: "Resolved",
}

export const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "All types",
  chat: "Buyer ↔ Seller",
  escrow: "Escrow",
  system: "Contact Us",
}

interface TriageFilterable {
  type: ConversationType
  flagged: boolean
  awaitingReply: boolean
  assignedToMe: boolean
  resolved: boolean
}

export function matchesStatus(row: TriageFilterable, status: StatusFilter): boolean {
  switch (status) {
    case "all":
      return true
    case "flagged":
      return row.flagged
    case "awaiting":
      return row.awaitingReply
    case "mine":
      return row.assignedToMe
    case "resolved":
      return row.resolved
  }
}

export function matchesType(row: TriageFilterable, type: TypeFilter): boolean {
  return type === "all" || row.type === type
}

function matchesQuery(haystack: Array<string | undefined>, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return haystack.some((field) => field?.toLowerCase().includes(q))
}

function conversationHaystack(c: TriageConversation): Array<string | undefined> {
  return [c.participantA.name, c.participantB.name, c.lastMessagePreview, c.tag]
}

function messageHaystack(m: TriageMessage): Array<string | undefined> {
  return [m.from.name, m.to.name, m.body, m.sku, m.tag]
}

export function filterConversations(
  conversations: TriageConversation[],
  filters: { status: StatusFilter; type: TypeFilter; query: string }
): TriageConversation[] {
  return conversations.filter(
    (c) =>
      matchesStatus(c, filters.status) &&
      matchesType(c, filters.type) &&
      matchesQuery(conversationHaystack(c), filters.query)
  )
}

export function filterMessages(
  messages: TriageMessage[],
  filters: { status: StatusFilter; type: TypeFilter; query: string }
): TriageMessage[] {
  return messages.filter(
    (m) =>
      matchesStatus(m, filters.status) &&
      matchesType(m, filters.type) &&
      matchesQuery(messageHaystack(m), filters.query)
  )
}

export function sortByTimestamp<T>(rows: T[], getIso: (row: T) => string, sortDesc: boolean): T[] {
  const sorted = [...rows].sort((a, b) => new Date(getIso(a)).getTime() - new Date(getIso(b)).getTime())
  return sortDesc ? sorted.reverse() : sorted
}

export function computeFacetCounts(
  mode: "conversations" | "messages",
  conversations: TriageConversation[],
  messages: TriageMessage[],
  filters: { status: StatusFilter; type: TypeFilter; query: string }
): TriageFacetCounts {
  if (mode === "conversations") {
    const status = {} as Record<StatusFilter, number>
    for (const s of STATUS_FILTERS) {
      status[s] = conversations.filter(
        (c) => matchesType(c, filters.type) && matchesStatus(c, s) && matchesQuery(conversationHaystack(c), filters.query)
      ).length
    }
    const type = {} as Record<TypeFilter, number>
    for (const t of TYPE_FILTERS) {
      type[t] = conversations.filter(
        (c) => matchesStatus(c, filters.status) && matchesType(c, t) && matchesQuery(conversationHaystack(c), filters.query)
      ).length
    }
    return { status, type }
  }

  const status = {} as Record<StatusFilter, number>
  for (const s of STATUS_FILTERS) {
    status[s] = messages.filter(
      (m) => matchesType(m, filters.type) && matchesStatus(m, s) && matchesQuery(messageHaystack(m), filters.query)
    ).length
  }
  const type = {} as Record<TypeFilter, number>
  for (const t of TYPE_FILTERS) {
    type[t] = messages.filter(
      (m) => matchesStatus(m, filters.status) && matchesType(m, t) && matchesQuery(messageHaystack(m), filters.query)
    ).length
  }
  return { status, type }
}

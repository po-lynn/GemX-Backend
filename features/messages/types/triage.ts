// Shapes for the Messages triage inbox (app/admin/messages). Mirrors the
// response shapes described in design_handoff_messages_triage/README.md's
// "Data needs" section so the mock layer and the future API layer agree.

export type ConversationType = "chat" | "escrow" | "system"
export type TypeFilter = "all" | ConversationType
export type StatusFilter = "all" | "flagged" | "awaiting" | "mine" | "resolved"
export type ListMode = "conversations" | "messages"

export interface TriageParticipant {
  id: string
  name: string
}

export interface TriageRisk {
  policyId: string
  policyLabel: string
  confidence: number
  detail: string
}

// One row of GET /admin/conversations
export interface TriageConversation {
  id: string
  participantA: TriageParticipant
  participantB: TriageParticipant
  type: ConversationType
  lastMessagePreview: string
  lastMessageAt: string // ISO timestamp
  messageCount: number
  tag?: string
  flagged: boolean
  awaitingReply: boolean
  assignedToMe: boolean
  resolved: boolean
  risk?: TriageRisk | null
}

// One row of GET /admin/messages
export interface TriageMessage {
  id: string
  conversationId: string
  from: TriageParticipant
  to: TriageParticipant
  body: string
  sentAt: string // ISO timestamp
  type: ConversationType
  sku?: string
  tag?: string
  flagged: boolean
  awaitingReply: boolean
  assignedToMe: boolean
  resolved: boolean
}

export interface TriageThreadMessage {
  id: string
  who: string
  mine: boolean
  sentAt: string // ISO timestamp
  text: string
  flagged?: boolean
}

// Response of GET /admin/conversations/:id/messages
export interface TriageThread {
  conversationId: string
  dateLabel: string
  messages: TriageThreadMessage[]
}

// Response of GET /admin/messages/facets — counts respect the *other* axis
export interface TriageFacetCounts {
  status: Record<StatusFilter, number>
  type: Record<TypeFilter, number>
}

export interface TriageFilterState {
  mode: ListMode
  status: StatusFilter
  type: TypeFilter
  query: string
  sortDesc: boolean
  selectedId: string | null
}

export type EscrowCaseState =
  | "requested"
  | "agent_assigned"
  | "verification"
  | "payment_pending"
  | "handover_scheduled"
  | "handover_confirmed"
  | "completed"
  | "cancelled"
  | "rejected"
  | "disputed"

export const ESCROW_CASE_STATE_LABELS: Record<EscrowCaseState, string> = {
  requested: "Requested",
  agent_assigned: "Agent assigned",
  verification: "Verification",
  payment_pending: "Payment pending",
  handover_scheduled: "Handover scheduled",
  handover_confirmed: "Handover confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  disputed: "Disputed",
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

export type EscrowCaseDetail = {
  id: string
  buyerId: string
  sellerId: string
  listingId: string
  listingTitle: string | null
  assignedAgentId: string | null
  agentName: string | null
  state: EscrowCaseState
  stateEnteredAt: string
  agreedPriceMinor: number
  currency: "USD" | "MMK"
  feeBps: number
  buyerFeeShareBps: number
  sellerFeeShareBps: number
  feeMinMinor: number | null
  feeCapMinor: number | null
  nextActionNote: string | null
  buyer: EscrowCaseParticipant
  seller: EscrowCaseParticipant
}

export type EscrowCaseMessageVisibility = "case" | "agent_buyer" | "agent_seller"

export const ESCROW_CASE_MESSAGE_VISIBILITY_LABELS: Record<EscrowCaseMessageVisibility, string> = {
  case: "Case thread",
  agent_buyer: "Private to buyer",
  agent_seller: "Private to seller",
}

export type EscrowCaseMessage = {
  id: string
  caseId: string
  senderId: string | null
  kind: "message" | "system"
  visibility: EscrowCaseMessageVisibility
  content: string
  fileUrl: string | null
  imageUrls: string[] | null
  attachmentType: "text" | "image" | "audio" | "file"
  systemEventType: string | null
  systemEventPayload: Record<string, unknown> | null
  createdAt: string
}

export type EscrowCaseAttachment = {
  id: string
  caseId: string
  messageId: string | null
  uploadedByUserId: string | null
  url: string
  fileType: "text" | "image" | "audio" | "file"
  label: string | null
  createdAt: string
}

export type EscrowCannedResponse = {
  id: string
  title: string
  bodyEn: string
  bodyMy: string
  isActive: boolean
  sortOrder: number
  createdByAdminId: string | null
  createdAt: string
  updatedAt: string
}

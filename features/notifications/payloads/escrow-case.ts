import type { NotificationScreen } from "@/features/notifications/types";

const ESCROW_CASE_FCM_DATA_KEYS = {
  type: "type",
  screen: "screen",
  caseId: "caseId",
  senderId: "senderId",
  messageId: "messageId",
  state: "state",
} as const;

export type EscrowCaseMessageNotificationDataInput = {
  caseId: string;
  senderId: string;
  messageId: string;
};

export type EscrowCaseStateChangeNotificationDataInput = {
  caseId: string;
  state: string;
};

/** FCM data for an escrow case state change — same "custom" catch-all screen as the
 *  message notification above, for the same reason (no new mobile screen in this task). */
export function buildEscrowCaseStateChangeNotificationData(
  input: EscrowCaseStateChangeNotificationDataInput
): Record<string, string> {
  const screen: NotificationScreen = "custom";
  return {
    [ESCROW_CASE_FCM_DATA_KEYS.type]: "escrow_case_state_changed",
    [ESCROW_CASE_FCM_DATA_KEYS.screen]: screen,
    [ESCROW_CASE_FCM_DATA_KEYS.caseId]: input.caseId,
    [ESCROW_CASE_FCM_DATA_KEYS.state]: input.state,
  };
}

/**
 * FCM data for an escrow case message. `screen: "custom"` (the existing catch-all) rather
 * than a new screen value: an old mobile build that doesn't know about case threads simply
 * ignores keys it doesn't recognize and still shows the OS-rendered title/body banner — no
 * new mobile screen is built as part of this admin-backend-only task. Deliberately doesn't
 * reuse buildChatMessageNotificationData's `conversationId`/`link` shape, which assumes a
 * 2-party getDirectConversationId pair that doesn't exist for a 3-party case.
 */
export function buildEscrowCaseMessageNotificationData(
  input: EscrowCaseMessageNotificationDataInput
): Record<string, string> {
  const screen: NotificationScreen = "custom";
  return {
    [ESCROW_CASE_FCM_DATA_KEYS.type]: "escrow_case_message",
    [ESCROW_CASE_FCM_DATA_KEYS.screen]: screen,
    [ESCROW_CASE_FCM_DATA_KEYS.caseId]: input.caseId,
    [ESCROW_CASE_FCM_DATA_KEYS.senderId]: input.senderId,
    [ESCROW_CASE_FCM_DATA_KEYS.messageId]: input.messageId,
  };
}

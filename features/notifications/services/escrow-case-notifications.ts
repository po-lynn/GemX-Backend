"use server";

import { sendPushNotificationToUserIds } from "@/features/notifications/services/send-push-notification";
import {
  buildEscrowCaseMessageNotificationData,
  buildEscrowCaseStateChangeNotificationData,
} from "@/features/notifications/payloads/escrow-case";
import { notificationLogger } from "@/features/notifications/logger";
import { ESCROW_CASE_STATE_LABELS, type EscrowCaseState } from "@/features/escrow-cases/types";

function truncatePreview(text: string, max = 120): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Push for a new escrow case message, to every case participant except the sender.
 * Reuses the same synchronous fire-and-forget FCM path as sendChatMessageNotification
 * (features/notifications/services/chat-notifications.ts) — not the background_jobs
 * queue, which this codebase reserves for genuinely bulk fan-out, not a ≤2-recipient send.
 */
export async function sendEscrowCaseMessageNotification(input: {
  caseId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  recipientIds: string[];
  preview: string;
}): Promise<void> {
  const recipients = Array.from(new Set(input.recipientIds.filter((id) => id !== input.senderId)));
  if (recipients.length === 0) return;

  const data = buildEscrowCaseMessageNotificationData({
    caseId: input.caseId,
    senderId: input.senderId,
    messageId: input.messageId,
  });

  const pushResult = await sendPushNotificationToUserIds(recipients, {
    title: input.senderName,
    body: truncatePreview(input.preview || "New message"),
    data,
  });

  notificationLogger.info("Escrow case push sent", {
    caseId: input.caseId,
    messageId: input.messageId,
    recipients: recipients.length,
    sent: pushResult.sent,
    failed: pushResult.failed,
  });
}

/** Push for a case state change (verification complete, handover scheduled, etc.), to
 *  the buyer and seller — they aren't logged into the admin panel to see the system
 *  message directly, so this is how they're told a state change happened. */
export async function sendEscrowCaseStateChangeNotification(input: {
  caseId: string;
  state: EscrowCaseState;
  recipientIds: string[];
}): Promise<void> {
  const recipients = Array.from(new Set(input.recipientIds.filter(Boolean)));
  if (recipients.length === 0) return;

  const data = buildEscrowCaseStateChangeNotificationData({ caseId: input.caseId, state: input.state });

  const pushResult = await sendPushNotificationToUserIds(recipients, {
    title: "Escrow case update",
    body: `Status changed to "${ESCROW_CASE_STATE_LABELS[input.state]}".`,
    data,
  });

  notificationLogger.info("Escrow case state-change push sent", {
    caseId: input.caseId,
    state: input.state,
    recipients: recipients.length,
    sent: pushResult.sent,
    failed: pushResult.failed,
  });
}

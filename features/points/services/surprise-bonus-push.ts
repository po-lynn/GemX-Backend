import { sendPushNotificationToUserIds } from "@/features/notifications/services/send-push-notification"
import type { PushNotificationPayload, PushSendResult } from "@/features/notifications/types"

export type SurpriseBonusPushInput = {
  userIds: string[]
  campaignId: string
  campaignName: string
  pointsPerUser: number
}

/** FCM title/body/data matching app_notification rows from grant_surprise_bonus_user. */
export function buildSurpriseBonusPushPayload(input: {
  campaignId: string
  campaignName: string
  pointsPerUser: number
}): PushNotificationPayload {
  const name = input.campaignName.trim() || "Surprise Bonus"
  const points = Math.max(0, Math.floor(input.pointsPerUser))
  return {
    title: `${name} 🎁`,
    body: `You received ${points} surprise bonus points!`,
    data: {
      type: "surprise_bonus",
      screen: "home",
      campaignId: input.campaignId,
      points: String(points),
    },
  }
}

/**
 * Send FCM to users who newly received a surprise bonus grant.
 * Failures are logged and do not roll back ledger / app_notification rows.
 */
export async function sendSurpriseBonusPushToUsers(
  input: SurpriseBonusPushInput,
): Promise<PushSendResult> {
  const userIds = Array.from(new Set(input.userIds.filter(Boolean)))
  if (userIds.length === 0) {
    return { sent: 0, failed: 0, invalidTokensRemoved: 0 }
  }

  const payload = buildSurpriseBonusPushPayload(input)
  try {
    return await sendPushNotificationToUserIds(userIds, payload)
  } catch (e) {
    console.error("[surprise-bonus] FCM push failed:", e)
    return { sent: 0, failed: userIds.length, invalidTokensRemoved: 0 }
  }
}

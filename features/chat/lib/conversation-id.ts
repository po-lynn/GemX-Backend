/**
 * Stable 1:1 conversation id for two user ids (order-independent).
 * Used in push payloads and active-chat view tracking.
 */
export function getDirectConversationId(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(":");
}

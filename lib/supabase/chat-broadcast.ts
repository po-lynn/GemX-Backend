import type { ChatMessage } from "@/features/chat/types/message";

export type ChatBroadcastEvent =
  | { event: "new_message"; payload: ChatMessage }
  | { event: "message_updated"; payload: ChatMessage }
  | { event: "message_deleted"; payload: { id: string } }
  | { event: "read_update"; payload: { messageIds: string[]; recipientId: string } };

type BroadcastTarget = ChatBroadcastEvent & { userId: string };

/**
 * Send one or more Broadcast events to user channels in a single HTTP request.
 * Fire-and-forget: caller should void + catch.
 *
 * Channel naming: `chat:<userId>` — clients subscribe to `chat:${currentUserId}`.
 */
export async function broadcastChatEvents(
  targets: BroadcastTarget[]
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || targets.length === 0) return;

  await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({
      messages: targets.map(({ userId, event, payload }) => ({
        topic: `realtime:chat:${userId}`,
        event,
        payload,
      })),
    }),
  });
}

import type { EscrowCaseMessageItem } from "@/features/escrow-cases/db/case-messages"

export type CaseBroadcastEvent =
  | { event: "case_message_new"; payload: EscrowCaseMessageItem }
  | { event: "case_state_changed"; payload: { caseId: string; state: string } }
  | { event: "case_read_update"; payload: { caseId: string; userId: string; lastReadAt: string } }

/**
 * Sibling to lib/supabase/chat-broadcast.ts, not a modification of it: escrow case threads
 * are 3-party and need their own topic convention (`case:<caseId>`, not the flat model's
 * per-user `chat:<userId>`). Fire-and-forget: caller should void + catch. No message-updated/
 * deleted events — case messages are immutable by design (no edit/delete path exists).
 */
export async function broadcastCaseEvents(caseId: string, events: CaseBroadcastEvent[]): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey || events.length === 0) return

  const res = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({
      messages: events.map(({ event, payload }) => ({
        topic: `realtime:case:${caseId}`,
        event,
        payload,
      })),
    }),
  })
  // See chat-broadcast.ts's identical check: fetch() only rejects on network failure,
  // so a non-2xx response must be thrown explicitly for the caller's `.catch(...)` to see it.
  if (!res.ok) {
    throw new Error(`Supabase broadcast failed: ${res.status} ${await res.text().catch(() => "")}`)
  }
}

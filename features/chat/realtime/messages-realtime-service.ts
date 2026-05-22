import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { chatRealtimeLogger } from "@/features/chat/realtime/logger";
import {
  normalizeChatMessageRow,
  type ChatMessage,
} from "@/features/chat/types/message";

export type MessagesRealtimeHandlers = {
  onInsert?: (message: ChatMessage) => void;
  onUpdate?: (message: ChatMessage, previous: Record<string, unknown>) => void;
  onDelete?: (oldRow: Record<string, unknown>) => void;
  onSubscriptionError?: (channelName: string, status: string) => void;
};

export type MessagesRealtimeSubscribeOptions = {
  /** Subscribe to messages you sent (updates sidebar outbound previews). Default true. */
  includeOutbound?: boolean;
  /** Subscribe to read-state updates on inbound messages. Default true. */
  includeReadUpdates?: boolean;
  /** Subscribe to inbound deletes (unread reconciliation). Default true. */
  includeInboundDeletes?: boolean;
};

/**
 * Reusable Supabase Realtime listener for `public.messages`.
 * Filters inbound events by `recipient_id=eq.<adminUserId>`.
 */
export class MessagesRealtimeService {
  private readonly adminUserId: string;
  private channels: RealtimeChannel[] = [];
  private processedIds = new Set<string>();
  private subscribed = false;

  constructor(adminUserId: string) {
    this.adminUserId = adminUserId;
  }

  subscribe(
    handlers: MessagesRealtimeHandlers,
    options: MessagesRealtimeSubscribeOptions = {}
  ): () => void {
    if (this.subscribed) {
      this.unsubscribe();
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      chatRealtimeLogger.warn("Supabase browser client not configured; Realtime disabled");
      return () => undefined;
    }

    const {
      includeOutbound = true,
      includeReadUpdates = true,
      includeInboundDeletes = true,
    } = options;

    const handleInsert = (raw: Record<string, unknown>) => {
      const row = normalizeChatMessageRow(raw);
      if (this.processedIds.has(row.id)) return;
      this.processedIds.add(row.id);
      handlers.onInsert?.(row);
    };

    const inbound = supabase
      .channel(`messages-in-${this.adminUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${this.adminUserId}`,
        },
        (payload) => {
          try {
            handleInsert(payload.new as Record<string, unknown>);
          } catch (e) {
            chatRealtimeLogger.error("Inbound INSERT handler failed", {
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          handlers.onSubscriptionError?.(`messages-in-${this.adminUserId}`, status);
          chatRealtimeLogger.error("Inbound channel error", { status });
        } else if (status === "SUBSCRIBED") {
          chatRealtimeLogger.info("Subscribed to inbound messages", {
            adminUserId: this.adminUserId,
          });
        }
      });
    this.channels.push(inbound);

    if (includeOutbound) {
      const outbound = supabase
        .channel(`messages-out-${this.adminUserId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `sender_id=eq.${this.adminUserId}`,
          },
          (payload) => {
            try {
              handleInsert(payload.new as Record<string, unknown>);
            } catch (e) {
              chatRealtimeLogger.error("Outbound INSERT handler failed", {
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }
        )
        .subscribe();
      this.channels.push(outbound);
    }

    if (includeReadUpdates) {
      const readUpdates = supabase
        .channel(`messages-read-${this.adminUserId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `recipient_id=eq.${this.adminUserId}`,
          },
          (payload) => {
            try {
              handlers.onUpdate?.(
                normalizeChatMessageRow(payload.new as Record<string, unknown>),
                (payload.old ?? {}) as Record<string, unknown>
              );
            } catch (e) {
              chatRealtimeLogger.error("UPDATE handler failed", {
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }
        )
        .subscribe();
      this.channels.push(readUpdates);
    }

    if (includeInboundDeletes) {
      const deletes = supabase
        .channel(`messages-del-${this.adminUserId}`)
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter: `recipient_id=eq.${this.adminUserId}`,
          },
          (payload) => {
            handlers.onDelete?.((payload.old ?? {}) as Record<string, unknown>);
          }
        )
        .subscribe();
      this.channels.push(deletes);
    }

    this.subscribed = true;

    return () => this.unsubscribe();
  }

  unsubscribe(): void {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    for (const ch of this.channels) {
      void supabase.removeChannel(ch);
    }
    this.channels = [];
    this.subscribed = false;
    chatRealtimeLogger.info("Unsubscribed from messages Realtime", {
      adminUserId: this.adminUserId,
    });
  }
}

export function createMessagesRealtimeService(
  adminUserId: string
): MessagesRealtimeService | null {
  if (!getSupabaseBrowserClient()) return null;
  return new MessagesRealtimeService(adminUserId);
}

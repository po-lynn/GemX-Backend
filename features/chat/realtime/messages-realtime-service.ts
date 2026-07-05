import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { chatRealtimeLogger } from "@/features/chat/realtime/logger";
import {
  normalizeChatMessageRow,
  type ChatMessage,
} from "@/features/chat/types/message";

export type MessagesRealtimeHandlers = {
  onInsert?: (message: ChatMessage) => void;
  /** Message text or starred state edited by the sender. */
  onUpdate?: (message: ChatMessage) => void;
  /** Message removed by the sender. */
  onDelete?: (id: string) => void;
  /** Batch read-receipt: the recipient marked these message IDs as read. */
  onReadUpdate?: (messageIds: string[], recipientId: string) => void;
  onSubscriptionError?: (channelName: string, status: string) => void;
  /**
   * Fired whenever the channel (re)connects, including the initial subscribe.
   * Broadcast is ephemeral — events sent while the socket was down are lost —
   * so consumers should resync server state (unread counts, open thread) here.
   */
  onResubscribe?: () => void;
};

/**
 * Supabase Broadcast listener for `chat:<userId>`.
 * Receives new_message / message_updated / message_deleted / read_update events
 * pushed by the server after each DB write — no WAL overhead.
 */
class MessagesRealtimeService {
  private readonly userId: string;
  private channel: RealtimeChannel | null = null;
  private processedIds = new Set<string>();
  private static readonly MAX_PROCESSED_IDS = 500;

  constructor(userId: string) {
    this.userId = userId;
  }

  private trackProcessed(id: string): boolean {
    if (this.processedIds.has(id)) return false;
    if (this.processedIds.size >= MessagesRealtimeService.MAX_PROCESSED_IDS) {
      this.processedIds.delete(this.processedIds.keys().next().value as string);
    }
    this.processedIds.add(id);
    return true;
  }

  subscribe(handlers: MessagesRealtimeHandlers): () => void {
    this.unsubscribe();

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      chatRealtimeLogger.warn("Supabase browser client not configured; Realtime disabled");
      return () => undefined;
    }

    const channelName = `chat:${this.userId}`;

    this.channel = supabase
      .channel(channelName)
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        try {
          const row = normalizeChatMessageRow(payload as Record<string, unknown>);
          if (!this.trackProcessed(row.id)) return;
          handlers.onInsert?.(row);
        } catch (e) {
          chatRealtimeLogger.error("new_message handler failed", {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      })
      .on("broadcast", { event: "message_updated" }, ({ payload }) => {
        try {
          handlers.onUpdate?.(normalizeChatMessageRow(payload as Record<string, unknown>));
        } catch (e) {
          chatRealtimeLogger.error("message_updated handler failed", {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      })
      .on("broadcast", { event: "message_deleted" }, ({ payload }) => {
        try {
          const p = payload as { id?: unknown };
          if (typeof p?.id === "string") handlers.onDelete?.(p.id);
        } catch (e) {
          chatRealtimeLogger.error("message_deleted handler failed", {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      })
      .on("broadcast", { event: "read_update" }, ({ payload }) => {
        try {
          const p = payload as { messageIds?: unknown; recipientId?: unknown };
          if (Array.isArray(p?.messageIds) && typeof p?.recipientId === "string") {
            handlers.onReadUpdate?.(p.messageIds as string[], p.recipientId);
          }
        } catch (e) {
          chatRealtimeLogger.error("read_update handler failed", {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          handlers.onSubscriptionError?.(channelName, status);
          chatRealtimeLogger.error("Channel error", { channelName, status });
        } else if (status === "SUBSCRIBED") {
          chatRealtimeLogger.info("Subscribed to chat broadcast channel", {
            userId: this.userId,
          });
          try {
            handlers.onResubscribe?.();
          } catch (e) {
            chatRealtimeLogger.error("onResubscribe handler failed", {
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      });

    return () => this.unsubscribe();
  }

  unsubscribe(): void {
    if (!this.channel) return;
    const supabase = getSupabaseBrowserClient();
    if (supabase) void supabase.removeChannel(this.channel);
    this.channel = null;
    this.processedIds.clear();
    chatRealtimeLogger.info("Unsubscribed from chat broadcast channel", {
      userId: this.userId,
    });
  }
}

export function createMessagesRealtimeService(
  userId: string
): MessagesRealtimeService | null {
  if (!getSupabaseBrowserClient()) return null;
  return new MessagesRealtimeService(userId);
}

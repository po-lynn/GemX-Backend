"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authClient } from "@/lib/auth-client";
import { createMessagesRealtimeService } from "@/features/chat/realtime/messages-realtime-service";
import { chatRealtimeLogger } from "@/features/chat/realtime/logger";
import {
  ensureChatNotificationPermission,
  showChatBrowserNotification,
} from "@/features/chat/notifications/browser-chat-notification";
import type { ChatMessage } from "@/features/chat/types/message";

type UnreadState = {
  total: number;
  byPeer: Record<string, number>;
};

type AdminChatNotificationContextValue = {
  totalUnread: number;
  byPeer: Record<string, number>;
  /** role === "admin" — system-wide oversight count/list, vs. internal staff's personal inbox. */
  isTrueAdmin: boolean;
  /** Peer user id for the open chat thread (null when none). Set from Chat Dashboard. */
  activeConversationPeerId: string | null;
  setActiveConversationPeerId: (peerId: string | null) => void;
  refreshUnread: () => Promise<void>;
};

const AdminChatNotificationContext = createContext<AdminChatNotificationContextValue | null>(
  null
);

/**
 * True admins oversee every conversation in the system rather than having a personal
 * inbox (see app/admin/chat-dashboard/page.tsx) — messages.isRead is scoped to the
 * actual recipient and doesn't map onto "has this admin seen the oversight feed", so
 * they get a separate system-wide "new since last view" count instead (byPeer is
 * meaningless for them and comes back empty).
 */
async function fetchUnreadCounts(isTrueAdmin: boolean): Promise<UnreadState> {
  const url = isTrueAdmin ? "/api/admin/chat/unread" : "/api/chat/unread";
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof (data as { error?: string }).error === "string"
        ? (data as { error: string }).error
        : "Failed to load unread counts"
    );
  }
  if (isTrueAdmin) {
    const total = typeof (data as { total?: number }).total === "number" ? (data as { total: number }).total : 0;
    return { total, byPeer: {} };
  }
  const d = data as { byPeer?: Record<string, number>; total?: number };
  const byPeer = d.byPeer ?? {};
  const total =
    typeof d.total === "number"
      ? d.total
      : Object.values(byPeer).reduce((s, n) => s + n, 0);
  return { total, byPeer };
}

type Props = {
  children: ReactNode;
};

export function AdminChatNotificationProvider({ children }: Props) {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const isTrueAdmin = session?.user?.role === "admin";
  // Both true admins (system-wide oversight) and internal staff (personal inbox) use the bell.
  const canUseChatNotifications = isTrueAdmin || session?.user?.role === "internal";

  const [unread, setUnread] = useState<UnreadState>({ total: 0, byPeer: {} });
  const [activeConversationPeerId, setActiveConversationPeerId] = useState<string | null>(
    null
  );
  const senderNamesRef = useRef<Record<string, string>>({});

  const refreshUnread = useCallback(async () => {
    if (!userId || !canUseChatNotifications) return;
    try {
      const next = await fetchUnreadCounts(isTrueAdmin);
      startTransition(() => setUnread(next));
    } catch (e) {
      chatRealtimeLogger.warn("Unread refresh failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, [userId, canUseChatNotifications, isTrueAdmin]);

  const shouldSuppressBrowserPopup = useCallback(
    (message: ChatMessage) => {
      if (message.recipientId !== userId) return true;
      return activeConversationPeerId === message.senderId;
    },
    [userId, activeConversationPeerId]
  );

  useEffect(() => {
    if (!userId || !canUseChatNotifications) return;
    void ensureChatNotificationPermission();
    const timer = window.setTimeout(() => {
      void refreshUnread();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userId, canUseChatNotifications, refreshUnread]);

  useEffect(() => {
    if (!userId || !canUseChatNotifications) return;

    const intervalMs = 30_000;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void refreshUnread();
    }, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshUnread();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, canUseChatNotifications, refreshUnread]);

  useEffect(() => {
    if (!userId || !canUseChatNotifications) return;

    const service = createMessagesRealtimeService(userId);
    if (!service) return;

    let unreadDebounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleUnreadRefresh = () => {
      if (unreadDebounce) clearTimeout(unreadDebounce);
      unreadDebounce = setTimeout(() => {
        unreadDebounce = null;
        void refreshUnread();
      }, 200);
    };

    const resolveSenderLabel = async (senderId: string): Promise<string> => {
      const cached = senderNamesRef.current[senderId];
      if (cached) return cached;
      try {
        const res = await fetch(`/api/profile/${encodeURIComponent(senderId)}`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        const name =
          typeof (data as { name?: string }).name === "string"
            ? (data as { name: string }).name
            : "New message";
        senderNamesRef.current[senderId] = name;
        return name;
      } catch {
        return "New message";
      }
    };

    const unsubscribe = service.subscribe({
      onInsert: (message) => {
        if (message.recipientId !== userId) return;

        scheduleUnreadRefresh();

        void (async () => {
          const label = await resolveSenderLabel(message.senderId);
          showChatBrowserNotification({
            message,
            senderLabel: label,
            suppress: shouldSuppressBrowserPopup(message),
          });
        })();
      },
      onReadUpdate: (_messageIds, recipientId) => {
        if (recipientId !== userId) return;
        scheduleUnreadRefresh();
      },
      onDelete: () => scheduleUnreadRefresh(),
      onSubscriptionError: (channel, status) => {
        chatRealtimeLogger.error("Realtime subscription error", { channel, status });
      },
    });

    return () => {
      if (unreadDebounce) clearTimeout(unreadDebounce);
      unsubscribe();
    };
  }, [userId, canUseChatNotifications, refreshUnread, shouldSuppressBrowserPopup]);

  const value = useMemo<AdminChatNotificationContextValue>(
    () => ({
      totalUnread: unread.total,
      byPeer: unread.byPeer,
      isTrueAdmin,
      activeConversationPeerId,
      setActiveConversationPeerId,
      refreshUnread,
    }),
    [unread, isTrueAdmin, activeConversationPeerId, refreshUnread]
  );

  return (
    <AdminChatNotificationContext.Provider value={value}>
      {children}
    </AdminChatNotificationContext.Provider>
  );
}

export function useAdminChatNotifications(): AdminChatNotificationContextValue {
  const ctx = useContext(AdminChatNotificationContext);
  if (!ctx) {
    return {
      totalUnread: 0,
      byPeer: {},
      isTrueAdmin: false,
      activeConversationPeerId: null,
      setActiveConversationPeerId: () => undefined,
      refreshUnread: async () => undefined,
    };
  }
  return ctx;
}

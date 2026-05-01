"use client"

import Image from "next/image"
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  Check,
  CheckCheck,
  ClipboardCopy,
  Copy,
  Forward,
  Loader2,
  MessageSquareText,
  Mic,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  Smile,
  Square,
  Star,
  Trash2,
  User,
  Video,
} from "lucide-react"

type ChatUser = {
  id: string
  name: string
  role: string
  image?: string | null
  /** Latest activity on a non-expired session (ISO); admin chat presence proxy. */
  lastSessionAt?: string | null
}

type ChatMessage = {
  id: string
  senderId: string
  recipientId: string
  content: string
  fileUrl: string | null
  imageUrls?: string[] | null
  messageType: "text" | "image" | "audio" | "file"
  isRead: boolean
  starred?: boolean
  editedAt?: string | null
  createdAt: string
}

type Props = {
  currentUserId: string
  users: ChatUser[]
  /** Select this peer when present in `users` (e.g. `?peer=` on chat dashboard). */
  initialPeerId?: string
}

type HistoryResponse = {
  messages: ChatMessage[]
  participantImage: string | null
}

const QUICK_EMOJIS = [
  "😀",
  "😂",
  "🥰",
  "😍",
  "😊",
  "😉",
  "👍",
  "🙏",
  "🔥",
  "✨",
  "❤️",
  "💎",
  "👋",
  "🎉",
  "😢",
  "😮",
  "🤔",
  "👀",
  "💬",
  "📎",
  "✅",
  "❌",
  "⭐",
  "🙌",
]

/** Matches server `ALLOWED_MEDIA_TYPES` in app/api/chat/media. */
const ATTACH_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,audio/webm,audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  if (p.length >= 2) return (p[0]![0]! + p[1]![0]!).toUpperCase()
  return name.slice(0, 2).toUpperCase() || "?"
}

function formatMessageTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function relativeTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins} min`
  if (hrs < 24) return `${hrs}h ago`
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

/** Session touched within this window ⇒ green dot + “Online” (Better Auth `session.updated_at`). */
const PRESENCE_ONLINE_WINDOW_MS = 5 * 60 * 1000

function isPeerOnline(lastSessionAtIso: string | null | undefined): boolean {
  if (!lastSessionAtIso) return false
  const t = new Date(lastSessionAtIso).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t < PRESENCE_ONLINE_WINDOW_MS
}

function peerPresenceSubtitle(
  lastSessionAtIso: string | null | undefined
): string {
  if (!lastSessionAtIso) return "Offline"
  if (isPeerOnline(lastSessionAtIso)) return "Online"
  return `Last active ${relativeTime(lastSessionAtIso)}`
}

function getImageUrlsFromMessage(m: ChatMessage): string[] {
  if (m.imageUrls?.length) return m.imageUrls
  if (
    m.messageType === "image" &&
    m.fileUrl &&
    /^https?:\/\//i.test(m.fileUrl)
  )
    return [m.fileUrl]
  return []
}

function previewFromMessage(m: ChatMessage): string {
  const imgs = getImageUrlsFromMessage(m)
  if (imgs.length > 1) return `${imgs.length} photos`
  if (m.messageType === "image" || imgs.length === 1 || (m.fileUrl && !m.content?.trim()))
    return "Photo"
  if (m.messageType === "audio") return "Voice message"
  if (m.fileUrl) return "Attachment"
  return (m.content || "").slice(0, 80)
}

function copyPayloadFromMessage(m: ChatMessage): string {
  const lines: string[] = []
  const text = (m.content || "").trim()
  if (text) lines.push(text)
  const urls = [
    ...getImageUrlsFromMessage(m),
    ...(m.messageType !== "image" && m.fileUrl ? [m.fileUrl] : []),
  ].filter(Boolean)
  const uniq = [...new Set(urls)]
  if (uniq.length) {
    if (lines.length) lines.push("")
    lines.push(...uniq)
  }
  return lines.join("\n").trim()
}

/** Supabase realtime payloads use snake_case column names. */
function buildForwardPayload(targetUserId: string, m: ChatMessage): Record<string, unknown> {
  const urls = getImageUrlsFromMessage(m)
  if (urls.length > 1) {
    return {
      recipientId: targetUserId,
      content: m.content ?? "",
      imageUrls: urls,
      messageType: "image",
    }
  }
  if (urls.length === 1) {
    return {
      recipientId: targetUserId,
      content: m.content ?? "",
      fileUrl: urls[0],
      messageType: "image",
    }
  }
  if (m.messageType === "audio" && m.fileUrl) {
    return {
      recipientId: targetUserId,
      content: m.content ?? "",
      fileUrl: m.fileUrl,
      messageType: "audio",
    }
  }
  if (m.messageType === "file" && m.fileUrl) {
    return {
      recipientId: targetUserId,
      content: m.content ?? "",
      fileUrl: m.fileUrl,
      messageType: "file",
    }
  }
  return {
    recipientId: targetUserId,
    content: m.content ?? "",
    messageType: "text",
  }
}

function normalizeChatRow(raw: Record<string, unknown>): ChatMessage {
  const imageUrlsRaw = raw.image_urls ?? raw.imageUrls
  const imageUrls =
    Array.isArray(imageUrlsRaw)
      ? imageUrlsRaw.filter((u): u is string => typeof u === "string")
      : null
  const mt = raw.message_type ?? raw.messageType
  return {
    id: String(raw.id),
    senderId: String(raw.sender_id ?? raw.senderId),
    recipientId: String(raw.recipient_id ?? raw.recipientId),
    content: String(raw.content ?? ""),
    fileUrl: (raw.file_url ?? raw.fileUrl) as string | null,
    imageUrls,
    messageType:
      mt === "image" || mt === "audio" || mt === "file" || mt === "text"
        ? mt
        : "text",
    isRead: Boolean(raw.is_read ?? raw.isRead),
    starred: Boolean(raw.starred),
    editedAt: raw.edited_at
      ? String(raw.edited_at)
      : raw.editedAt
        ? String(raw.editedAt)
        : null,
    createdAt: String(raw.created_at ?? raw.createdAt),
  }
}

function messageTypeFromMime(mime: string): ChatMessage["messageType"] {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("audio/")) return "audio"
  return "file"
}

/**
 * One row in the left sidebar: peer profile + last activity + unread count.
 * Updated immediately from Supabase `postgres_changes` (INSERT/UPDATE/DELETE)
 * and reconciled with `GET /api/chat/unread` when needed.
 */
export type ChatConversation = {
  user: ChatUser
  unreadCount: number
  preview: string
  lastAt: string
}

function sortConversationsForSidebar(
  items: ChatConversation[]
): ChatConversation[] {
  const sorted = [...items]
  sorted.sort((a, b) => {
    const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0
    const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0
    if (tb !== ta) return tb - ta
    return b.unreadCount - a.unreadCount
  })
  return sorted
}

function buildConversationsFromUsers(
  us: ChatUser[],
  prev: ChatConversation[] | null
): ChatConversation[] {
  const prevById = new Map((prev ?? []).map((x) => [x.user.id, x]))
  return us.map((u) => {
    const p = prevById.get(u.id)
    return {
      user: u,
      unreadCount: p?.unreadCount ?? 0,
      preview: p?.preview ?? u.role,
      lastAt: p?.lastAt ?? "",
    }
  })
}

export function ChatDashboard({ currentUserId, users, initialPeerId }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id ?? "")
  const [sessionActivityByUserId, setSessionActivityByUserId] = useState<
    Record<string, string | null>
  >(() => {
    const acc: Record<string, string | null> = {}
    for (const u of users) acc[u.id] = u.lastSessionAt ?? null
    return acc
  })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  /** Left sidebar: live list driven by React state + Supabase Realtime (see postgres_changes effect). */
  const [conversations, setConversations] = useState<ChatConversation[]>(() =>
    sortConversationsForSidebar(buildConversationsFromUsers(users, null))
  )
  const threadEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const processedRealtimeIds = useRef<Set<string>>(new Set())

  const [newChatOpen, setNewChatOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoStreamRef = useRef<MediaStream | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)

  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaChunksRef = useRef<Blob[]>([])

  const [forwardOpen, setForwardOpen] = useState(false)
  const [forwardSource, setForwardSource] = useState<ChatMessage | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editText, setEditText] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null)
  const [unreadDividerIndex, setUnreadDividerIndex] = useState<number | null>(null)

  /** Reconcile `conversations[].unreadCount` with Postgres (after realtime or read/delete). */
  const refreshUnreadCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/unread", { credentials: "include" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return
      const byPeer = (data as { byPeer?: Record<string, number> }).byPeer ?? {}
      setConversations((prev) => {
        const next = prev.map((row) => ({
          ...row,
          unreadCount:
            row.user.id === selectedUserId ? 0 : (byPeer[row.user.id] ?? 0),
        }))
        return sortConversationsForSidebar(next)
      })
    } catch {
      /* ignore */
    }
  }, [selectedUserId])

  useEffect(() => {
    void refreshUnreadCounts()
  }, [refreshUnreadCounts])

  /**
   * Poll unread counts from Postgres while this screen is open. Supabase `postgres_changes`
   * on `messages` often does not fire until Realtime is enabled for that table — Postman/API
   * inserts still update counts here within a few seconds.
   */
  useEffect(() => {
    const intervalMs = 3500
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      void refreshUnreadCounts()
    }
    const id = setInterval(tick, intervalMs)
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void refreshUnreadCounts()
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [refreshUnreadCounts])

  useEffect(() => {
    setConversations((prev) =>
      sortConversationsForSidebar(buildConversationsFromUsers(users, prev))
    )
  }, [users])

  useEffect(() => {
    setSessionActivityByUserId((prev) => {
      const next = { ...prev }
      for (const u of users) {
        if (u.lastSessionAt != null) next[u.id] = u.lastSessionAt
      }
      return next
    })
  }, [users])

  /** Refresh peer presence from DB (non-expired session activity). */
  useEffect(() => {
    const ids = users.map((u) => u.id)
    if (ids.length === 0) return
    let cancelled = false
    const load = async () => {
      try {
        const params = new URLSearchParams({ ids: ids.join(",") })
        const res = await fetch(`/api/admin/chat/presence?${params}`, {
          credentials: "include",
        })
        const data = (await res.json()) as {
          activity?: Record<string, string | null>
        }
        if (!res.ok || cancelled || !data.activity) return
        setSessionActivityByUserId((prev) => ({ ...prev, ...data.activity }))
      } catch {
        /* ignore */
      }
    }
    void load()
    const interval = setInterval(load, 60_000)
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void load()
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [users])

  useEffect(() => {
    setUnreadDividerIndex(null)
  }, [selectedUserId])

  useEffect(() => {
    if (!initialPeerId) return
    if (users.some((u) => u.id === initialPeerId)) {
      setSelectedUserId(initialPeerId)
    }
  }, [initialPeerId, users])

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(
      (row) =>
        row.user.name.toLowerCase().includes(q) ||
        row.user.role.toLowerCase().includes(q)
    )
  }, [conversations, search])

  const selectedUser = useMemo(
    () =>
      conversations.find((row) => row.user.id === selectedUserId)?.user ??
      users.find((u) => u.id === selectedUserId) ??
      null,
    [conversations, users, selectedUserId]
  )

  /** Apply one new/updated message to the matching peer row (called from Realtime + local sends). */
  const patchConversationFromMessage = useCallback(
    (peerId: string, m: ChatMessage, opts?: { incrementUnread?: boolean }) => {
      setConversations((prev) => {
        const idx = prev.findIndex((x) => x.user.id === peerId)
        if (idx === -1) return prev
        const row = prev[idx]!
        let unreadCount = row.unreadCount
        if (opts?.incrementUnread === true) {
          unreadCount += 1
          if (peerId === selectedUserId) unreadCount = 0
        }
        const updated = [...prev]
        updated[idx] = {
          ...row,
          preview: previewFromMessage(m),
          lastAt:
            typeof m.createdAt === "string" ? m.createdAt : String(m.createdAt),
          unreadCount,
        }
        return sortConversationsForSidebar(updated)
      })
    },
    [selectedUserId]
  )

  const loadHistory = useCallback(async () => {
    if (!selectedUserId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/chat/history?userId=${encodeURIComponent(selectedUserId)}&page=1&limit=100`,
        { credentials: "include" }
      )
      const data = (await res.json().catch(() => ({}))) as Partial<HistoryResponse> & {
        error?: string
      }
      if (!res.ok) throw new Error(data?.error ?? "Failed to load messages")
      const list = Array.isArray(data.messages) ? data.messages : []
      setMessages(list)

      const dividerIdx = list.findIndex(
        (m) =>
          m.recipientId === currentUserId &&
          m.senderId === selectedUserId &&
          !m.isRead
      )
      setUnreadDividerIndex(dividerIdx >= 0 ? dividerIdx : null)

      const unreadIncoming = list.filter(
        (m) =>
          m.recipientId === currentUserId &&
          m.senderId === selectedUserId &&
          !m.isRead
      )
      if (unreadIncoming.length > 0) {
        await fetch("/api/chat/read-status", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageIds: unreadIncoming.map((m) => m.id) }),
        })
        setMessages((prev) =>
          prev.map((m) =>
            unreadIncoming.some((u) => u.id === m.id) ? { ...m, isRead: true } : m
          )
        )
      }

      const last = list[list.length - 1]
      if (last) {
        setConversations((prev) => {
          const idx = prev.findIndex((x) => x.user.id === selectedUserId)
          if (idx === -1) return prev
          const row = prev[idx]!
          const next = [...prev]
          next[idx] = {
            ...row,
            preview: previewFromMessage(last),
            lastAt:
              typeof last.createdAt === "string"
                ? last.createdAt
                : String(last.createdAt),
            unreadCount: 0,
          }
          return sortConversationsForSidebar(next)
        })
      }

      await refreshUnreadCounts()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load messages"
      setError(msg)
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [selectedUserId, currentUserId, refreshUnreadCounts])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, selectedUserId])

  useEffect(() => {
    if (!videoOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        videoStreamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
      } catch {
        setError("Could not access camera or microphone for video preview.")
      }
    })()
    return () => {
      cancelled = true
      videoStreamRef.current?.getTracks().forEach((t) => t.stop())
      videoStreamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [videoOpen])

  useEffect(() => {
    if (!phoneOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        audioStreamRef.current = stream
      } catch {
        setError("Could not access microphone for voice call preview.")
      }
    })()
    return () => {
      cancelled = true
      audioStreamRef.current?.getTracks().forEach((t) => t.stop())
      audioStreamRef.current = null
    }
  }, [phoneOpen])

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) return

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    let unreadSyncTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleUnreadSync = () => {
      if (unreadSyncTimer) clearTimeout(unreadSyncTimer)
      unreadSyncTimer = setTimeout(() => {
        unreadSyncTimer = null
        void refreshUnreadCounts()
      }, 200)
    }

    /** Merge a realtime message row into `conversations` (sidebar) immediately — no page refresh. */
    const handleInsert = (raw: Record<string, unknown>) => {
      const row = normalizeChatRow(raw)
      const other =
        row.senderId === currentUserId ? row.recipientId : row.senderId
      if (!users.some((u) => u.id === other)) return
      if (processedRealtimeIds.current.has(row.id)) return
      processedRealtimeIds.current.add(row.id)

      patchConversationFromMessage(other, row, {
        incrementUnread:
          row.recipientId === currentUserId &&
          row.senderId !== selectedUserId &&
          !row.isRead,
      })

      if (row.recipientId === currentUserId) {
        scheduleUnreadSync()
      }

      const inThread =
        (row.senderId === currentUserId && row.recipientId === selectedUserId) ||
        (row.senderId === selectedUserId && row.recipientId === currentUserId)
      if (!inThread) return

      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev
        const next = [...prev, row].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        return next
      })

      if (
        row.recipientId === currentUserId &&
        row.senderId === selectedUserId &&
        !row.isRead
      ) {
        fetch("/api/chat/read-status", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageIds: [row.id] }),
        }).catch(() => {})
        setMessages((prev) =>
          prev.map((m) => (m.id === row.id ? { ...m, isRead: true } : m))
        )
        scheduleUnreadSync()
      }
    }

    const handleUpdate = (payload: {
      new: Record<string, unknown>
      old: Record<string, unknown>
    }) => {
      const n = normalizeChatRow(payload.new)
      const wasRead = Boolean(payload.old.is_read ?? payload.old.isRead)
      const nowRead = Boolean(payload.new.is_read ?? payload.new.isRead)
      if (n.recipientId !== currentUserId) return
      if (nowRead && !wasRead) {
        if (n.senderId === selectedUserId) {
          setMessages((prev) =>
            prev.map((m) => (m.id === n.id ? { ...m, isRead: true } : m))
          )
        }
        scheduleUnreadSync()
      }
    }

    const handleDelete = (payload: { old: Record<string, unknown> }) => {
      const o = payload.old
      const recipientId = String(o.recipient_id ?? o.recipientId ?? "")
      const wasRead = Boolean(o.is_read ?? o.isRead)
      if (recipientId !== currentUserId || wasRead) return
      scheduleUnreadSync()
    }

    const inbound = supabase
      .channel(`chat-dash-in-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => handleInsert(payload.new as Record<string, unknown>)
      )
      .subscribe()

    const outbound = supabase
      .channel(`chat-dash-out-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${currentUserId}`,
        },
        (payload) => handleInsert(payload.new as Record<string, unknown>)
      )
      .subscribe()

    const readUpdates = supabase
      .channel(`chat-dash-read-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) =>
          handleUpdate({
            new: payload.new as Record<string, unknown>,
            old: (payload.old ?? {}) as Record<string, unknown>,
          })
      )
      .subscribe()

    const incomingDeletes = supabase
      .channel(`chat-dash-del-in-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) =>
          handleDelete({ old: (payload.old ?? {}) as Record<string, unknown> })
      )
      .subscribe()

    return () => {
      if (unreadSyncTimer) clearTimeout(unreadSyncTimer)
      supabase.removeChannel(inbound)
      supabase.removeChannel(outbound)
      supabase.removeChannel(readUpdates)
      supabase.removeChannel(incomingDeletes)
    }
  }, [currentUserId, selectedUserId, users, patchConversationFromMessage, refreshUnreadCounts])

  async function sendMessage(body: {
    content?: string
    fileUrl?: string
    imageUrls?: string[]
    messageType?: ChatMessage["messageType"]
  }) {
    if (!selectedUserId || sending) return
    setSending(true)
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: selectedUserId,
          ...body,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Send failed")
      const saved = (data as { message?: ChatMessage }).message
      if (saved) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === saved.id)) return prev
          return [...prev, saved].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        })
        patchConversationFromMessage(selectedUserId, saved)
      }
      setDraft("")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Send failed")
    } finally {
      setSending(false)
    }
  }

  async function uploadAndSend(file: File, messageType: ChatMessage["messageType"]) {
    if (!selectedUserId || uploading) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set("file", file)
      const up = await fetch("/api/chat/media", {
        method: "POST",
        body: fd,
        credentials: "include",
      })
      const data = await up.json().catch(() => ({}))
      if (!up.ok) throw new Error((data as { error?: string }).error ?? "Upload failed")
      const url = (data as { url?: string }).url
      if (!url) throw new Error("No URL returned")
      await sendMessage({
        content: "",
        fileUrl: url,
        messageType,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function uploadImagesAndSend(files: File[]) {
    if (!selectedUserId || uploading || files.length === 0) return
    setUploading(true)
    setError(null)
    const caption = draft.trim()
    try {
      const urls: string[] = []
      for (const file of files) {
        const fd = new FormData()
        fd.set("file", file)
        const up = await fetch("/api/chat/media", {
          method: "POST",
          body: fd,
          credentials: "include",
        })
        const data = await up.json().catch(() => ({}))
        if (!up.ok) throw new Error((data as { error?: string }).error ?? "Upload failed")
        const url = (data as { url?: string }).url
        if (!url) throw new Error("No URL returned")
        urls.push(url)
      }
      await sendMessage({
        content: caption,
        imageUrls: urls,
        messageType: "image",
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    await sendMessage({ content: text, messageType: "text" })
  }

  async function onPickAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (!files.length || !selectedUserId || uploading) return
    const images = files.filter((f) => f.type.startsWith("image/"))
    if (images.length >= 2 && images.length === files.length) {
      await uploadImagesAndSend(images)
      return
    }
    const file = files[0]!
    const mt = messageTypeFromMime(file.type || "")
    await uploadAndSend(file, mt)
  }

  async function patchStar(m: ChatMessage) {
    if (m.senderId !== currentUserId) return
    try {
      const res = await fetch(`/api/chat/messages/${encodeURIComponent(m.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: !m.starred }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Update failed")
      const updated = (data as { message?: ChatMessage }).message
      if (updated) {
        setMessages((prev) =>
          prev.map((x) => (x.id === updated!.id ? { ...x, ...updated } : x))
        )
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed")
    }
  }

  async function saveEditedMessage() {
    if (!editingId) return
    try {
      const res = await fetch(`/api/chat/messages/${encodeURIComponent(editingId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editText }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Save failed")
      const updated = (data as { message?: ChatMessage }).message
      if (updated) {
        setMessages((prev) =>
          prev.map((x) => (x.id === updated!.id ? { ...x, ...updated } : x))
        )
      }
      setEditOpen(false)
      setEditingId(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed")
    }
  }

  async function confirmDeleteMessage() {
    if (!pendingDelete) return
    try {
      const res = await fetch(`/api/chat/messages/${encodeURIComponent(pendingDelete.id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Delete failed")
      setMessages((prev) => prev.filter((x) => x.id !== pendingDelete.id))
      setDeleteOpen(false)
      setPendingDelete(null)
      await refreshUnreadCounts()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed")
    }
  }

  async function confirmForward(targetUserId: string) {
    if (!forwardSource) return
    setSending(true)
    setError(null)
    try {
      const body = buildForwardPayload(targetUserId, forwardSource)
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Forward failed")
      const saved = (data as { message?: ChatMessage }).message
      if (saved && targetUserId === selectedUserId) {
        setMessages((prev) => {
          if (prev.some((x) => x.id === saved.id)) return prev
          return [...prev, saved].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        })
        patchConversationFromMessage(selectedUserId, saved)
      }
      setForwardOpen(false)
      setForwardSource(null)
      await refreshUnreadCounts()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Forward failed")
    } finally {
      setSending(false)
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setError("Could not copy to clipboard.")
    }
  }

  function conversationLink(): string {
    if (typeof window === "undefined") return ""
    const base = `${window.location.origin}/admin/chat-dashboard`
    return selectedUserId ? `${base}?peer=${encodeURIComponent(selectedUserId)}` : base
  }

  async function toggleVoiceRecording() {
    if (!selectedUserId || uploading || sending) return
    if (recording) {
      const mr = mediaRecorderRef.current
      mediaRecorderRef.current = null
      mr?.stop()
      setRecording(false)
      return
    }
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaChunksRef.current = []
      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ]
      const mime =
        mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? ""
      const mr = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream)
      mr.ondataavailable = (ev) => {
        if (ev.data.size) mediaChunksRef.current.push(ev.data)
      }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blobType = mr.mimeType.split(";")[0] || "audio/webm"
        const blob = new Blob(mediaChunksRef.current, { type: blobType })
        const ext =
          blobType.includes("ogg") || blobType.includes("opus") ? "ogg" : "webm"
        const file = new File([blob], `voice-${Date.now()}.${ext}`, {
          type: blobType === "audio/ogg" ? "audio/ogg" : "audio/webm",
        })
        await uploadAndSend(file, "audio")
      }
      mr.start(250)
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch {
      setError("Microphone access was denied or unavailable.")
    }
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] max-h-[720px] min-h-[480px] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* New chat */}
      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>New chat</DialogTitle>
            <DialogDescription>
              Choose someone to open their conversation.
            </DialogDescription>
          </DialogHeader>
          <Command className="rounded-none border-t">
            <CommandInput placeholder="Search people..." />
            <CommandList>
              <CommandEmpty>No users found.</CommandEmpty>
              <CommandGroup heading="People">
                {users.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={`${u.name} ${u.role}`}
                    onSelect={() => {
                      setSelectedUserId(u.id)
                      setNewChatOpen(false)
                    }}
                  >
                    <span className="truncate font-medium">{u.name}</span>
                    <span className="text-muted-foreground ml-2 truncate text-xs">
                      {u.role}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Video preview (local stream — dashboard demo) */}
      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Video call</DialogTitle>
            <DialogDescription>
              Local camera preview. Peer calling is not connected — this uses your
              device only.
            </DialogDescription>
          </DialogHeader>
          <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setVideoOpen(false)}>
              Hang up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice call preview */}
      <Dialog open={phoneOpen} onOpenChange={setPhoneOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Voice call</DialogTitle>
            <DialogDescription>
              Microphone is active for this preview. Full PSTN / VoIP routing is not
              wired here.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/15">
              <Phone className="size-8 text-emerald-600" aria-hidden />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              <span className="mr-2 inline-flex gap-0.5">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-600 [animation-delay:0ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-600 [animation-delay:200ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-600 [animation-delay:400ms]" />
              </span>
              Connected (mic)
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setPhoneOpen(false)}>
              End call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forward message */}
      <Dialog
        open={forwardOpen}
        onOpenChange={(o) => {
          setForwardOpen(o)
          if (!o) setForwardSource(null)
        }}
      >
        <DialogContent className="overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>Forward message</DialogTitle>
            <DialogDescription>
              Choose who should receive a copy of this message.
            </DialogDescription>
          </DialogHeader>
          <Command className="rounded-none border-t">
            <CommandInput placeholder="Search people..." />
            <CommandList>
              <CommandEmpty>No users found.</CommandEmpty>
              <CommandGroup heading="People">
                {users.map((u) => (
                    <CommandItem
                      key={u.id}
                      value={`${u.name} ${u.role}`}
                      onSelect={() => void confirmForward(u.id)}
                    >
                      <span className="truncate font-medium">{u.name}</span>
                      <span className="text-muted-foreground ml-2 truncate text-xs">
                        {u.role}
                      </span>
                    </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit message</DialogTitle>
            <DialogDescription>Update the text shown in this message.</DialogDescription>
          </DialogHeader>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={5}
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[120px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveEditedMessage()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete message?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDeleteMessage()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Left: chats list */}
      <div className="flex w-full max-w-[340px] shrink-0 flex-col border-r border-border bg-muted/30">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold tracking-tight">Chats</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setNewChatOpen(true)}
          >
            <Plus className="size-4" />
            <span className="sr-only">New chat</span>
          </Button>
        </div>
        <div className="border-b border-border px-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Chats search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-lg border-border bg-background pl-9 text-sm"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {filteredConversations.map((row) => {
            const u = row.user
            const selected = selectedUserId === u.id
            const unread = row.unreadCount
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUserId(u.id)}
                className={cn(
                  "mb-1 flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  selected ? "bg-[#e8e8e8]" : "hover:bg-muted/80"
                )}
              >
                <div className="relative h-11 w-11 shrink-0">
                  <div className="relative h-full w-full overflow-hidden rounded-full bg-muted ring-1 ring-border">
                    {u.image ? (
                      <Image
                        src={u.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="44px"
                        unoptimized={
                          u.image.startsWith("blob:") || u.image.startsWith("data:")
                        }
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary/15 text-xs font-semibold text-primary">
                        {initials(u.name)}
                      </div>
                    )}
                  </div>
                  {isPeerOnline(sessionActivityByUserId[u.id] ?? null) ? (
                    <span
                      className="pointer-events-none absolute bottom-0 right-0 z-10 size-[10px] translate-x-[32%] translate-y-[32%] rounded-full border-2 border-background bg-emerald-500 shadow-sm"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate font-medium leading-tight">{u.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {row.lastAt ? relativeTime(row.lastAt) : "1hr ago"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {row.preview || u.role}
                    </p>
                    {unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-semibold text-white">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
          {filteredConversations.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No users match your search.
            </p>
          )}
        </div>
      </div>

      {/* Right: thread */}
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-10 w-10 shrink-0">
              <div className="relative h-full w-full overflow-hidden rounded-full bg-muted ring-1 ring-border">
                {selectedUser?.image ? (
                  <Image
                    src={selectedUser.image}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="40px"
                    unoptimized={
                      selectedUser.image.startsWith("blob:") ||
                      selectedUser.image.startsWith("data:")
                    }
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary/15 text-xs font-semibold text-primary">
                    {selectedUser ? initials(selectedUser.name) : "?"}
                  </div>
                )}
              </div>
              {selectedUser &&
              isPeerOnline(sessionActivityByUserId[selectedUser.id] ?? null) ? (
                <span
                  className="pointer-events-none absolute bottom-0 right-0 z-10 size-[10px] translate-x-[32%] translate-y-[32%] rounded-full border-2 border-background bg-emerald-500 shadow-sm"
                  aria-hidden
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold leading-tight">
                {selectedUser?.name ?? "Select a chat"}
              </div>
              {selectedUser ? (
                <div
                  className={cn(
                    "text-xs font-medium",
                    isPeerOnline(sessionActivityByUserId[selectedUser.id] ?? null)
                      ? "text-emerald-600"
                      : "text-muted-foreground"
                  )}
                >
                  {peerPresenceSubtitle(
                    sessionActivityByUserId[selectedUser.id] ?? null
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              disabled={!selectedUser}
              onClick={() => setVideoOpen(true)}
              title="Video call preview"
            >
              <Video className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              disabled={!selectedUser}
              onClick={() => setPhoneOpen(true)}
              title="Voice call preview"
            >
              <Phone className="size-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  disabled={!selectedUser}
                  title="More options"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="end">
                <div className="space-y-3 px-1 pb-2">
                  <div className="flex items-start gap-2">
                    <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {selectedUser?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{selectedUser?.role}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 border-t pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-start gap-2 font-normal"
                    onClick={() => copyText(conversationLink())}
                  >
                    <ClipboardCopy className="size-4 shrink-0" />
                    Copy conversation link
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-start gap-2 font-normal"
                    onClick={() =>
                      selectedUser && copyText(selectedUser.id)
                    }
                  >
                    <Copy className="size-4 shrink-0" />
                    Copy user ID
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <p className="text-center text-sm text-muted-foreground">Loading messages…</p>
          )}
          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}
          {!loading && !error && messages.length === 0 && selectedUser && (
            <p className="text-center text-sm text-muted-foreground">
              No messages yet. Say hello!
            </p>
          )}
          <div className="space-y-4">
            {messages.map((m, index) => {
              const mine = m.senderId === currentUserId
              const imgs = getImageUrlsFromMessage(m)
              const showGallery = m.messageType === "image" && imgs.length > 0
              const showAudio =
                m.messageType === "audio" && m.fileUrl && /^https?:\/\//i.test(m.fileUrl)
              const copyAll = copyPayloadFromMessage(m)
              const msgActions = (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "mt-1 h-7 w-7 shrink-0",
                        mine ? "opacity-70 hover:opacity-100" : "opacity-50"
                      )}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-1" align={mine ? "end" : "start"}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-full justify-start gap-2 px-2 font-normal"
                      onClick={() => {
                        setForwardSource(m)
                        setForwardOpen(true)
                      }}
                    >
                      <Forward className="size-4 shrink-0" />
                      Forward
                    </Button>
                    {mine ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 w-full justify-start gap-2 px-2 font-normal"
                          onClick={() => void patchStar(m)}
                        >
                          <Star
                            className={cn(
                              "size-4 shrink-0",
                              m.starred ? "fill-amber-400 text-amber-600" : ""
                            )}
                          />
                          {m.starred ? "Unstar" : "Star"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 w-full justify-start gap-2 px-2 font-normal"
                          onClick={() => {
                            setEditingId(m.id)
                            setEditText(m.content ?? "")
                            setEditOpen(true)
                          }}
                        >
                          <Pencil className="size-4 shrink-0" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 w-full justify-start gap-2 px-2 font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            setPendingDelete(m)
                            setDeleteOpen(true)
                          }}
                        >
                          <Trash2 className="size-4 shrink-0" />
                          Delete
                        </Button>
                      </>
                    ) : null}
                    <div className="bg-border my-1 h-px w-full shrink-0" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-full justify-start gap-2 px-2 font-normal"
                      onClick={() =>
                        m.content?.trim() ? copyText(m.content) : undefined
                      }
                      disabled={!m.content?.trim()}
                    >
                      <MessageSquareText className="size-4 shrink-0" />
                      Copy text
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-full justify-start gap-2 px-2 font-normal"
                      onClick={() => (copyAll ? copyText(copyAll) : undefined)}
                      disabled={!copyAll}
                    >
                      <ClipboardCopy className="size-4 shrink-0" />
                      Copy text & links
                    </Button>
                    {imgs.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-full justify-start gap-2 px-2 font-normal"
                        onClick={() => copyText(imgs.join("\n"))}
                      >
                        <Copy className="size-4 shrink-0" />
                        Copy image URLs
                      </Button>
                    ) : null}
                    {showAudio && m.fileUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-full justify-start gap-2 px-2 font-normal"
                        onClick={() => copyText(m.fileUrl!)}
                      >
                        <Copy className="size-4 shrink-0" />
                        Copy audio URL
                      </Button>
                    ) : null}
                    {m.messageType === "file" && m.fileUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-full justify-start gap-2 px-2 font-normal"
                        onClick={() => copyText(m.fileUrl!)}
                      >
                        <Copy className="size-4 shrink-0" />
                        Copy file URL
                      </Button>
                    ) : null}
                  </PopoverContent>
                </Popover>
              )

              return (
                <Fragment key={m.id}>
                  {unreadDividerIndex !== null && index === unreadDividerIndex ? (
                    <div className="flex items-center gap-3 py-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                        Unread messages
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "flex gap-2",
                      mine ? "justify-end" : "justify-start"
                    )}
                  >
                    {msgActions}
                    <div
                      className={cn(
                        "max-w-[min(85%,28rem)] rounded-2xl px-3 py-2 text-sm shadow-sm",
                        mine
                          ? "rounded-br-md bg-emerald-600 text-white"
                          : "rounded-bl-md border border-border bg-muted text-foreground",
                        !mine && !m.isRead && "ring-2 ring-emerald-500/35"
                      )}
                    >
                    {showGallery ? (
                      <div
                        className={cn(
                          "mt-1 grid gap-1",
                          imgs.length > 1 ? "grid-cols-2" : "grid-cols-1"
                        )}
                      >
                        {imgs.map((url) => (
                          <div
                            key={url}
                            className="relative aspect-square max-h-52 w-full max-w-44 overflow-hidden rounded-lg bg-black/5"
                          >
                            <Image
                              src={url}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 40vw, 200px"
                              unoptimized
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {showAudio ? (
                      <audio
                        controls
                        src={m.fileUrl!}
                        className={cn(
                          "mt-2 w-full max-w-xs",
                          mine ? "[&::-webkit-media-controls-panel]:bg-emerald-700/90" : ""
                        )}
                      />
                    ) : null}
                    {m.messageType === "file" && m.fileUrl ? (
                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "mt-1 inline-flex items-center gap-1 underline",
                          mine ? "text-white/95" : "text-primary"
                        )}
                      >
                        Open file
                      </a>
                    ) : null}
                    {m.content?.trim() ? (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    ) : null}
                    {!showGallery && !showAudio && m.fileUrl && m.messageType !== "file" ? (
                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "mt-1 inline-block underline",
                          mine ? "text-white/90" : "text-primary"
                        )}
                      >
                        Open attachment
                      </a>
                    ) : null}
                    <div
                      className={cn(
                        "mt-1 flex items-center justify-end gap-1 text-[11px]",
                        mine ? "text-white/75" : "text-muted-foreground"
                      )}
                    >
                      {m.starred && mine ? (
                        <Star
                          className="size-3 shrink-0 fill-amber-400 text-amber-500"
                          aria-label="Starred"
                        />
                      ) : null}
                      <span>{formatMessageTime(m.createdAt)}</span>
                      {m.editedAt ? (
                        <span className={mine ? "text-white/60" : ""}>(edited)</span>
                      ) : null}
                      {mine &&
                        (m.isRead ? (
                          <CheckCheck
                            className="size-3.5 shrink-0 text-emerald-200"
                            aria-label="Read"
                          />
                        ) : (
                          <Check className="size-3.5 shrink-0 text-white/70" aria-label="Sent" />
                        ))}
                    </div>
                  </div>
                  </div>
                </Fragment>
              )
            })}
            <div ref={threadEndRef} />
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="border-t border-border bg-muted/20 px-4 py-3"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ATTACH_ACCEPT}
            className="hidden"
            onChange={onPickAttachment}
          />
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-background px-2 py-2 shadow-sm">
            <div className="flex flex-1 items-center gap-1 pb-0.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    title="Emoji"
                  >
                    <Smile className="size-5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start" side="top">
                  <div className="grid grid-cols-8 gap-1">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="rounded-md p-1.5 text-lg leading-none hover:bg-muted"
                        onClick={() => setDraft((d) => d + emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={uploading || !selectedUserId || recording}
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
              >
                <Paperclip className="size-5 text-muted-foreground" />
              </Button>
              <input
                type="text"
                placeholder="Enter message..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-9 flex-1 border-0 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9 shrink-0",
                  recording && "text-destructive hover:text-destructive"
                )}
                disabled={uploading || !selectedUserId || sending}
                onClick={toggleVoiceRecording}
                title={recording ? "Stop and send recording" : "Record voice message"}
              >
                {recording ? (
                  <Square className="size-5 fill-current" />
                ) : (
                  <Mic className="size-5 text-muted-foreground" />
                )}
              </Button>
            </div>
            <Button
              type="submit"
              size="sm"
              className="shrink-0 rounded-xl px-5 font-semibold"
              disabled={
                sending ||
                uploading ||
                recording ||
                !draft.trim() ||
                !selectedUserId
              }
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Send"
              )}
            </Button>
          </div>
          {recording && (
            <p className="mt-2 flex items-center justify-center gap-2 text-center text-xs font-medium text-destructive">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-destructive" />
              Recording… tap the square to stop and send
            </p>
          )}
          {(uploading || sending) && !recording && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {uploading ? "Uploading…" : "Sending…"}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

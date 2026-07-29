"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Bell } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAdminChatNotifications } from "@/features/chat/context/admin-chat-notification-context"

type PersonalPreviewItem = {
  userId: string
  name: string
  profileImage: string | null
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
}

type AdminPreviewParticipant = {
  id: string
  name: string
  image: string | null
}

type AdminPreviewItem = {
  participants: [AdminPreviewParticipant, AdminPreviewParticipant]
  lastMessage: string
  lastMessageTime: string
}

type PreviewResponse = {
  conversations?: (PersonalPreviewItem | AdminPreviewItem)[]
  error?: string
}

function relativeTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m`
  if (hrs < 24) return `${hrs}h`
  if (days < 7) return `${days}d`
  return d.toLocaleDateString()
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return name.slice(0, 2).toUpperCase() || "?"
}

function isAdminPreviewItem(item: PersonalPreviewItem | AdminPreviewItem): item is AdminPreviewItem {
  return "participants" in item
}

function Avatar({ image, name, size }: { image: string | null; name: string; size: number }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full ring-1 ring-border/60"
      style={{ width: size, height: size }}
    >
      {image ? (
        <Image src={image} alt={name} fill className="object-cover" referrerPolicy="no-referrer" sizes={`${size}px`} />
      ) : (
        <div className="grid h-full w-full place-items-center bg-violet-100 text-xs font-semibold text-violet-600">
          {initials(name)}
        </div>
      )}
    </div>
  )
}

export function NotificationBell() {
  const { totalUnread, refreshUnread, isTrueAdmin } = useAdminChatNotifications()
  const [open, setOpen] = useState(false)
  const [conversations, setConversations] = useState<(PersonalPreviewItem | AdminPreviewItem)[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Marking the admin feed "seen" changes totalUnread, which is itself a dependency below
  // (so a genuinely new message while the dropdown is open triggers a refetch) — this ref
  // absorbs the one re-run our own mark-seen call causes, so it doesn't refetch to empty.
  const justMarkedSeenRef = useRef(false)

  useEffect(() => {
    if (!open) return
    if (justMarkedSeenRef.current) {
      justMarkedSeenRef.current = false
      return
    }
    let cancelled = false

    const loadPreview = async () => {
      setLoading(true)
      setError(null)
      try {
        const url = isTrueAdmin ? "/api/admin/chat/unread/preview" : "/api/chat/unread/preview"
        const res = await fetch(url, { credentials: "include" })
        const data = (await res.json().catch(() => ({}))) as PreviewResponse
        if (!res.ok) throw new Error(data.error ?? "Failed to load notifications")
        if (!cancelled) setConversations(Array.isArray(data.conversations) ? data.conversations : [])

        // System-wide oversight has no per-message read state (see admin-chat-cursor) —
        // opening the dropdown marks the feed seen, clearing the badge on the next poll.
        if (isTrueAdmin) {
          await fetch("/api/admin/chat/seen", { method: "PATCH", credentials: "include" })
          justMarkedSeenRef.current = true
          if (!cancelled) void refreshUnread()
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load notifications")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadPreview()
    return () => {
      cancelled = true
    }
    // Re-fetch whenever the badge count changes while the dropdown is open (e.g. a new message arrives).
  }, [open, totalUnread, isTrueAdmin, refreshUnread])

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void refreshUnread()
      }}
    >
      <PopoverTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
          aria-label={totalUnread > 0 ? `Notifications (${totalUnread} unread)` : "Notifications"}
        >
          <Bell className="h-4 w-4" />
          {totalUnread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 rounded-xl border border-border p-0 shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {totalUnread > 0 && (
            <span className="text-xs text-muted-foreground">{totalUnread} unread</span>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto p-1.5">
          {loading && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          )}
          {!loading && error && (
            <p className="px-3 py-6 text-center text-sm text-destructive">{error}</p>
          )}
          {!loading && !error && conversations.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          )}
          {!loading &&
            !error &&
            conversations.map((c, idx) =>
              isAdminPreviewItem(c) ? (
                <Link
                  key={`${c.participants[0].id}:${c.participants[1].id}:${idx}`}
                  href="/admin/chat-dashboard"
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-accent/40"
                >
                  <div className="flex -space-x-2">
                    <Avatar image={c.participants[0].image} name={c.participants[0].name} size={28} />
                    <Avatar image={c.participants[1].image} name={c.participants[1].name} size={28} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {c.participants[0].name} <span className="font-normal text-muted-foreground">↔</span>{" "}
                        {c.participants[1].name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {relativeTime(c.lastMessageTime)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.lastMessage || "—"}</p>
                  </div>
                </Link>
              ) : (
                <Link
                  key={c.userId}
                  href={`/admin/chat-dashboard?peer=${encodeURIComponent(c.userId)}`}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-accent/40"
                >
                  <Avatar image={c.profileImage} name={c.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {relativeTime(c.lastMessageTime)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-muted-foreground">{c.lastMessage || "—"}</p>
                      <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                        {c.unreadCount}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            )}
        </div>

        <div className="border-t border-border p-1.5">
          <Link
            href="/admin/chat-dashboard"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-2.5 py-2 text-center text-xs font-medium text-primary transition-colors hover:bg-accent/40"
          >
            View all conversations
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}

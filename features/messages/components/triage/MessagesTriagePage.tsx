"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TriageHeader } from "@/features/messages/components/triage/TriageHeader"
import { FilterRails } from "@/features/messages/components/triage/FilterRails"
import { ConversationList, type TriageListRow } from "@/features/messages/components/triage/ConversationList"
import { ReadingPane } from "@/features/messages/components/triage/ReadingPane"
import { deleteMessageAction, setMessageStarredAction } from "@/features/messages/actions/messages"
import {
  computeFacetCounts,
  filterConversations,
  filterMessages,
  sortByTimestamp,
  STATUS_LABELS,
} from "@/features/messages/lib/triage-filters"
import type {
  ListMode,
  StatusFilter,
  TriageConversation,
  TriageMessage,
  TriageThread,
  TriageThreadMessage,
  TypeFilter,
} from "@/features/messages/types/triage"

type Props = {
  initialConversations: TriageConversation[]
  initialMessages: TriageMessage[]
  currentUserId: string
}

function formatRowTime(iso: string): string {
  const date = new Date(iso)
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })
}

function notWiredToast() {
  toast("Not wired yet in this preview.")
}

type ThreadApiRow = {
  id: string
  senderId: string
  content: string
  fileUrl: string | null
  imageUrls: string[] | null
  messageType: string
  createdAt: string
  starred: boolean
}

export function MessagesTriagePage({ initialConversations, initialMessages, currentUserId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const mode: ListMode = searchParams.get("mode") === "messages" ? "messages" : "conversations"
  const status = (searchParams.get("status") as StatusFilter) || "all"
  const type = (searchParams.get("type") as TypeFilter) || "all"
  const sortDesc = searchParams.get("sortDesc") !== "false"
  const selectedIdParam = searchParams.get("selectedId")

  // Query is filtered locally on every keystroke (the row set is already on
  // the client — the README's ~150ms debounce is for hitting a real API,
  // which only the thread fetch below actually does) and only synced to the
  // URL on a delay so linkability doesn't spam history.
  const [queryDraft, setQueryDraft] = useState(searchParams.get("query") ?? "")
  const [noteValue, setNoteValue] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [flagPending, setFlagPending] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [replyValue, setReplyValue] = useState("")
  const [replyPending, setReplyPending] = useState(false)

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === "") params.delete(key)
        else params.set(key, value)
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  useEffect(() => {
    const handle = setTimeout(() => {
      if (queryDraft !== (searchParams.get("query") ?? "")) {
        updateParams({ query: queryDraft || undefined })
      }
    }, 150)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryDraft])

  const filters = useMemo(() => ({ status, type, query: queryDraft }), [status, type, queryDraft])

  const conversationsFiltered = useMemo(
    () => sortByTimestamp(filterConversations(initialConversations, filters), (c) => c.lastMessageAt, sortDesc),
    [initialConversations, filters, sortDesc]
  )
  const messagesFiltered = useMemo(
    () => sortByTimestamp(filterMessages(initialMessages, filters), (m) => m.sentAt, sortDesc),
    [initialMessages, filters, sortDesc]
  )

  const activeRows = mode === "conversations" ? conversationsFiltered : messagesFiltered
  const effectiveSelectedId =
    (selectedIdParam && activeRows.some((r) => r.id === selectedIdParam) ? selectedIdParam : activeRows[0]?.id) ??
    null

  // If the requested selection isn't in the current mode/filter's rows (e.g.
  // right after switching modes, or a filter change hid the selected row),
  // silently correct the URL to the resolved fallback.
  useEffect(() => {
    if (effectiveSelectedId !== selectedIdParam) {
      updateParams({ selectedId: effectiveSelectedId ?? undefined })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSelectedId, selectedIdParam])

  const facets = useMemo(
    () => computeFacetCounts(mode, initialConversations, initialMessages, filters),
    [mode, initialConversations, initialMessages, filters]
  )

  const selectedMessage: TriageMessage | null =
    mode === "messages" ? (initialMessages.find((m) => m.id === effectiveSelectedId) ?? null) : null

  const activeConversation = useMemo(() => {
    if (!effectiveSelectedId) return null
    if (mode === "conversations") {
      return initialConversations.find((c) => c.id === effectiveSelectedId) ?? null
    }
    if (!selectedMessage) return null
    return initialConversations.find((c) => c.id === selectedMessage.conversationId) ?? null
  }, [mode, effectiveSelectedId, initialConversations, selectedMessage])

  const [thread, setThread] = useState<TriageThread | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState<string | null>(null)

  // Who a reply from this admin session actually goes to. `null` when the
  // logged-in user isn't one of the two participants (a pure-oversight admin
  // browsing a buyer<->seller thread they aren't part of) — replying on their
  // behalf would be ambiguous, so the composer disables itself in that case.
  const replyTarget = useMemo(() => {
    if (!activeConversation) return null
    if (activeConversation.participantA.id === currentUserId) return activeConversation.participantB
    if (activeConversation.participantB.id === currentUserId) return activeConversation.participantA
    return null
  }, [activeConversation, currentUserId])

  useEffect(() => {
    setReplyValue("")
  }, [effectiveSelectedId])

  const fetchThread = useCallback(async () => {
    if (!activeConversation) {
      setThread(null)
      setThreadError(null)
      return
    }
    setThreadLoading(true)
    setThreadError(null)
    try {
      const params = new URLSearchParams({
        userA: activeConversation.participantA.id,
        userB: activeConversation.participantB.id,
        page: "1",
        limit: "200",
      })
      const res = await fetch(`/api/admin/messages/thread?${params}`, { credentials: "include" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to load messages")
      const rows: ThreadApiRow[] = Array.isArray((data as { messages?: ThreadApiRow[] }).messages)
        ? (data as { messages: ThreadApiRow[] }).messages
        : []
      const threadMessages: TriageThreadMessage[] = rows.map((r) => ({
        id: r.id,
        who:
          r.senderId === activeConversation.participantA.id
            ? activeConversation.participantA.name
            : activeConversation.participantB.name,
        mine: r.senderId === currentUserId,
        sentAt: r.createdAt,
        text: r.content,
        fileUrl: r.fileUrl,
        imageUrls: r.imageUrls,
        messageType: r.messageType,
        flagged: r.starred,
      }))
      setThread({ conversationId: activeConversation.id, messages: threadMessages })
    } catch (e) {
      setThreadError(e instanceof Error ? e.message : "Failed to load messages")
    } finally {
      setThreadLoading(false)
    }
  }, [activeConversation, currentUserId])

  useEffect(() => {
    fetchThread()
  }, [fetchThread])

  // Sends as the logged-in session's own user id (POST /api/chat/messages
  // derives senderId from the session, not from anything passed here) to
  // whichever participant isn't the current user — this is what lets an
  // escrow-service account (or any admin/internal user who is themselves a
  // conversation participant) actually reply from /admin/messages instead of
  // only being able to view the thread.
  async function handleSendReply() {
    const content = replyValue.trim()
    if (!content || !replyTarget || replyPending) return
    setReplyPending(true)
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: replyTarget.id, content }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to send reply")
      setReplyValue("")
      await fetchThread()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send reply")
    } finally {
      setReplyPending(false)
    }
  }

  const listRows: TriageListRow[] = useMemo(() => {
    if (mode === "conversations") {
      return conversationsFiltered.map((c) => ({
        id: c.id,
        avatarId: c.participantA.id,
        avatarName: c.participantA.name,
        title: `${c.participantA.name} ↔ ${c.participantB.name}`,
        preview: c.lastMessagePreview,
        time: formatRowTime(c.lastMessageAt),
        meta: `${c.messageCount} messages`,
        tag: c.tag,
        selected: c.id === effectiveSelectedId,
      }))
    }
    return messagesFiltered.map((m) => ({
      id: m.id,
      avatarId: m.from.id,
      avatarName: m.from.name,
      title: `${m.from.name} → ${m.to.name}`,
      preview: m.body,
      time: formatRowTime(m.sentAt),
      tag: m.tag,
      selected: m.id === effectiveSelectedId,
    }))
  }, [mode, conversationsFiltered, messagesFiltered, effectiveSelectedId])

  const resultLabel = `${STATUS_LABELS[status]} · ${activeRows.length} ${mode === "conversations" ? "conversations" : "messages"}`

  // Flag/Delete are only unambiguous when a single real message is selected
  // (All messages mode). In Conversations mode there's no one message these
  // buttons could act on — see docs/technical/messages-triage.md.
  async function handleFlag() {
    if (!selectedMessage) {
      notWiredToast()
      return
    }
    setFlagPending(true)
    const formData = new FormData()
    formData.set("id", selectedMessage.id)
    formData.set("starred", (!selectedMessage.flagged).toString())
    const result = await setMessageStarredAction(formData)
    setFlagPending(false)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    toast.success(selectedMessage.flagged ? "Message unflagged" : "Message flagged")
    router.refresh()
  }

  function handleDeleteClick() {
    if (!selectedMessage) {
      notWiredToast()
      return
    }
    setDeleteOpen(true)
  }

  async function confirmDelete() {
    if (!selectedMessage) return
    setDeletePending(true)
    const formData = new FormData()
    formData.set("id", selectedMessage.id)
    const result = await deleteMessageAction(formData)
    setDeletePending(false)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    setDeleteOpen(false)
    toast.success("Message deleted")
    router.refresh()
  }

  return (
    <div className="-mx-3 -my-5 flex h-[calc(100vh-4rem)] flex-col overflow-hidden md:-mx-10">
      <TriageHeader
        mode={mode}
        onModeChange={(next) => updateParams({ mode: next === "conversations" ? undefined : next })}
        conversationCount={initialConversations.length}
        messageCount={initialMessages.length}
        onExport={notWiredToast}
        onNewMessage={notWiredToast}
      />

      <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-[1200px] flex-1">
          <FilterRails
            status={status}
            type={type}
            facets={facets}
            onStatusChange={(next) => updateParams({ status: next === "all" ? undefined : next })}
            onTypeChange={(next) => updateParams({ type: next === "all" ? undefined : next })}
            slaText="4 flagged items breach in under 2h."
          />
          <ConversationList
            mode={mode}
            query={queryDraft}
            onQueryChange={setQueryDraft}
            sortDesc={sortDesc}
            onToggleSort={() => updateParams({ sortDesc: sortDesc ? "false" : undefined })}
            resultLabel={resultLabel}
            rows={listRows}
            onSelectRow={(id) => updateParams({ selectedId: id })}
          />
          <ReadingPane
            conversation={activeConversation}
            thread={thread}
            threadLoading={threadLoading}
            threadError={threadError}
            onRetryThread={fetchThread}
            noteValue={noteValue}
            onNoteChange={setNoteValue}
            onSaveNote={notWiredToast}
            replyValue={replyValue}
            onReplyChange={setReplyValue}
            onSendReply={handleSendReply}
            replyPending={replyPending}
            replyTargetName={replyTarget?.name ?? null}
            onFlag={handleFlag}
            onDelete={handleDeleteClick}
            onResolve={notWiredToast}
            onOverflow={notWiredToast}
            flagPending={flagPending}
            deletePending={deletePending}
          />
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete message</DialogTitle>
            <DialogDescription>
              This permanently deletes the selected message. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deletePending}>
              {deletePending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { MessageSquareText, Plus } from "lucide-react"
import { toast } from "sonner"
import { ConversationList, type TriageListRow } from "@/features/messages/components/triage/ConversationList"
import { EscrowCaseThreadView } from "@/features/escrow-cases/components/EscrowCaseThreadView"
import { NewEscrowCaseDialog } from "@/features/escrow-cases/components/NewEscrowCaseDialog"
import { ReassignCaseDialog } from "@/features/escrow-cases/components/ReassignCaseDialog"
import {
  ESCROW_CASE_STATE_LABELS,
  type EscrowCaseAttachment,
  type EscrowCaseDetail,
  type EscrowCaseListItem,
  type EscrowCaseMessage,
  type EscrowCaseMessageVisibility,
  type EscrowCannedResponse,
} from "@/features/escrow-cases/types"
import { formatMoneyMinor } from "@/features/escrow-cases/lib/money"
import type { EscrowCaseState } from "@/features/escrow-cases/lib/state-machine"

type Props = {
  initialCases: EscrowCaseListItem[]
  currentUserId: string
  canReassign: boolean
}

function formatRowTime(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })
}

export function EscrowCaseInboxPage({ initialCases, currentUserId, canReassign }: Props) {
  const [cases, setCases] = useState(initialCases)
  const [selectedId, setSelectedId] = useState<string | null>(initialCases[0]?.id ?? null)
  const [query, setQuery] = useState("")
  const [newCaseOpen, setNewCaseOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)

  const [caseDetail, setCaseDetail] = useState<EscrowCaseDetail | null>(null)
  const [messages, setMessages] = useState<EscrowCaseMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [replyValue, setReplyValue] = useState("")
  const [replyChannel, setReplyChannel] = useState<EscrowCaseMessageVisibility>("case")
  const [replyPending, setReplyPending] = useState(false)
  const [transitionPending, setTransitionPending] = useState(false)

  const [pendingAttachment, setPendingAttachment] = useState<{ file: File; previewUrl: string | null } | null>(
    null
  )
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [cannedResponses, setCannedResponses] = useState<EscrowCannedResponse[]>([])
  const [attachments, setAttachments] = useState<EscrowCaseAttachment[]>([])
  const [showEvidence, setShowEvidence] = useState(false)

  const filteredCases = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return cases
    return cases.filter((c) =>
      [c.buyer.name, c.seller.name, c.listingTitle ?? ""].some((field) => field.toLowerCase().includes(q))
    )
  }, [cases, query])

  const rows: TriageListRow[] = useMemo(
    () =>
      filteredCases.map((c) => ({
        id: c.id,
        avatarId: c.buyer.id,
        avatarName: c.buyer.name,
        title: `${c.buyer.name} ↔ ${c.seller.name}`,
        preview: `${c.listingTitle ?? "Listing"} · ${formatMoneyMinor(c.agreedPriceMinor, c.currency)}`,
        time: formatRowTime(c.lastMessageAt ?? c.stateEnteredAt),
        meta: ESCROW_CASE_STATE_LABELS[c.state],
        selected: c.id === selectedId,
        awaitingReply: c.hasUnread,
      })),
    [filteredCases, selectedId]
  )

  const fetchCase = useCallback(async () => {
    if (!selectedId) {
      setCaseDetail(null)
      setMessages([])
      setAttachments([])
      return
    }
    setLoading(true)
    setError(null)
    // Reset to the shared channel and clear any pending attachment on every (re)load —
    // a stale "private to buyer/seller" selection or an in-progress attachment from a
    // previous case must never carry over onto a newly selected one.
    setReplyChannel("case")
    setPendingAttachment(null)
    try {
      const [caseRes, messagesRes, attachmentsRes] = await Promise.all([
        fetch(`/api/admin/escrow-cases/${selectedId}`, { credentials: "include" }),
        fetch(`/api/admin/escrow-cases/${selectedId}/messages`, { credentials: "include" }),
        fetch(`/api/admin/escrow-cases/${selectedId}/attachments`, { credentials: "include" }),
      ])
      const caseData = await caseRes.json().catch(() => ({}))
      if (!caseRes.ok) throw new Error((caseData as { error?: string }).error ?? "Failed to load case")
      const messagesData = await messagesRes.json().catch(() => ({}))
      if (!messagesRes.ok) throw new Error((messagesData as { error?: string }).error ?? "Failed to load messages")
      const attachmentsData = await attachmentsRes.json().catch(() => ({}))

      setCaseDetail((caseData as { case: EscrowCaseDetail }).case)
      setMessages((messagesData as { messages: EscrowCaseMessage[] }).messages ?? [])
      setAttachments((attachmentsData as { attachments?: EscrowCaseAttachment[] }).attachments ?? [])

      void fetch(`/api/admin/escrow-cases/${selectedId}/read`, { method: "PATCH", credentials: "include" }).catch(
        () => {}
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load case")
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    queueMicrotask(fetchCase)
  }, [fetchCase])

  useEffect(() => {
    void fetch("/api/admin/escrow-canned-responses", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setCannedResponses((data as { responses?: EscrowCannedResponse[] }).responses ?? []))
      .catch(() => {})
  }, [])

  const refreshCases = useCallback(async (selectAfter?: string) => {
    try {
      const res = await fetch("/api/admin/escrow-cases", { credentials: "include" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to load cases")
      setCases((data as { cases: EscrowCaseListItem[] }).cases ?? [])
      if (selectAfter) setSelectedId(selectAfter)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to refresh cases")
    }
  }, [])

  function messageTypeFromMime(mime: string): "image" | "file" {
    return mime.startsWith("image/") ? "image" : "file"
  }

  function handlePickAttachment(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return { file, previewUrl }
    })
  }

  function handleRemoveAttachment() {
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }

  function handleInsertCannedResponse(bodyEn: string) {
    setReplyValue((prev) => (prev ? `${prev}\n${bodyEn}` : bodyEn))
  }

  async function handleSendReply() {
    const content = replyValue.trim()
    if (!selectedId || (!content && !pendingAttachment) || replyPending) return
    setReplyPending(true)
    try {
      let fileUrl: string | undefined
      let imageUrls: string[] | undefined
      let attachmentType: "image" | "file" | undefined

      if (pendingAttachment) {
        setAttachmentUploading(true)
        const formData = new FormData()
        formData.set("file", pendingAttachment.file)
        const uploadRes = await fetch("/api/chat/media", { method: "POST", body: formData, credentials: "include" })
        const uploadData = await uploadRes.json().catch(() => ({}))
        setAttachmentUploading(false)
        if (!uploadRes.ok) throw new Error((uploadData as { error?: string }).error ?? "Failed to upload attachment")
        const url = (uploadData as { url?: string }).url
        if (!url) throw new Error("Upload did not return a URL")
        attachmentType = messageTypeFromMime(pendingAttachment.file.type)
        if (attachmentType === "image") imageUrls = [url]
        else fileUrl = url
      }

      const res = await fetch(`/api/admin/escrow-cases/${selectedId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content || undefined,
          visibility: replyChannel,
          fileUrl,
          imageUrls,
          attachmentType,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to send message")
      setReplyValue("")
      handleRemoveAttachment()
      await fetchCase()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send message")
    } finally {
      setAttachmentUploading(false)
      setReplyPending(false)
    }
  }

  async function handleTransition(toState: EscrowCaseState) {
    if (!selectedId || transitionPending) return
    setTransitionPending(true)
    try {
      const res = await fetch(`/api/admin/escrow-cases/${selectedId}/transition`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toState }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to update case state")
      await fetchCase()
      await refreshCases()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update case state")
    } finally {
      setTransitionPending(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-extrabold tracking-[-0.02em] text-[#17161c]">Escrow Cases</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/messages/escrow/canned-responses"
            className="flex h-9 items-center gap-1.5 rounded-[9px] border border-[#e3e3ec] bg-white px-3.5 text-[13px] font-semibold text-[#3d3c49] hover:border-[#cfcfe0]"
          >
            <MessageSquareText className="size-4" /> Templates
          </Link>
          <button
            type="button"
            onClick={() => setNewCaseOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-[9px] bg-[#7c3aed] px-3.5 text-[13px] font-bold text-white hover:bg-[#6d28d9]"
          >
            <Plus className="size-4" /> New Case
          </button>
        </div>
      </div>
      <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border border-[#ececf3]">
        <ConversationList
          mode="conversations"
          query={query}
          onQueryChange={setQuery}
          sortDesc
          onToggleSort={() => {}}
          resultLabel={`${filteredCases.length} case${filteredCases.length === 1 ? "" : "s"}`}
          rows={rows}
          onSelectRow={setSelectedId}
        />
        <EscrowCaseThreadView
          caseDetail={caseDetail}
          messages={messages}
          messagesLoading={loading}
          messagesError={error}
          onRetry={fetchCase}
          currentUserId={currentUserId}
          replyValue={replyValue}
          onReplyChange={setReplyValue}
          onSendReply={handleSendReply}
          replyPending={replyPending}
          replyChannel={replyChannel}
          onReplyChannelChange={setReplyChannel}
          canReply
          onTransition={handleTransition}
          transitionPending={transitionPending}
          canReassign={canReassign}
          onOpenReassign={() => setReassignOpen(true)}
          pendingAttachment={pendingAttachment}
          onPickAttachment={handlePickAttachment}
          onRemoveAttachment={handleRemoveAttachment}
          attachmentUploading={attachmentUploading}
          cannedResponses={cannedResponses}
          onInsertCannedResponse={handleInsertCannedResponse}
          attachments={attachments}
          showEvidence={showEvidence}
          onToggleEvidence={() => setShowEvidence((v) => !v)}
        />
      </div>
      <NewEscrowCaseDialog
        open={newCaseOpen}
        onOpenChange={setNewCaseOpen}
        onCreated={(caseId) => void refreshCases(caseId)}
      />
      {selectedId && (
        <ReassignCaseDialog
          open={reassignOpen}
          onOpenChange={setReassignOpen}
          caseId={selectedId}
          currentAgentId={caseDetail?.assignedAgentId ?? null}
          onReassigned={() => {
            void fetchCase()
            void refreshCases()
          }}
        />
      )}
    </div>
  )
}

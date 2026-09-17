"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { ConversationList, type TriageListRow } from "@/features/messages/components/triage/ConversationList"
import { EscrowCaseThreadView } from "@/features/escrow-cases/components/EscrowCaseThreadView"
import { NewEscrowCaseDialog } from "@/features/escrow-cases/components/NewEscrowCaseDialog"
import { ESCROW_CASE_STATE_LABELS, type EscrowCaseDetail, type EscrowCaseListItem, type EscrowCaseMessage } from "@/features/escrow-cases/types"
import { formatMoneyMinor } from "@/features/escrow-cases/lib/money"

type Props = {
  initialCases: EscrowCaseListItem[]
  currentUserId: string
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

export function EscrowCaseInboxPage({ initialCases, currentUserId }: Props) {
  const [cases, setCases] = useState(initialCases)
  const [selectedId, setSelectedId] = useState<string | null>(initialCases[0]?.id ?? null)
  const [query, setQuery] = useState("")
  const [newCaseOpen, setNewCaseOpen] = useState(false)

  const [caseDetail, setCaseDetail] = useState<EscrowCaseDetail | null>(null)
  const [messages, setMessages] = useState<EscrowCaseMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [replyValue, setReplyValue] = useState("")
  const [replyPending, setReplyPending] = useState(false)

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
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [caseRes, messagesRes] = await Promise.all([
        fetch(`/api/admin/escrow-cases/${selectedId}`, { credentials: "include" }),
        fetch(`/api/admin/escrow-cases/${selectedId}/messages`, { credentials: "include" }),
      ])
      const caseData = await caseRes.json().catch(() => ({}))
      if (!caseRes.ok) throw new Error((caseData as { error?: string }).error ?? "Failed to load case")
      const messagesData = await messagesRes.json().catch(() => ({}))
      if (!messagesRes.ok) throw new Error((messagesData as { error?: string }).error ?? "Failed to load messages")

      setCaseDetail((caseData as { case: EscrowCaseDetail }).case)
      setMessages((messagesData as { messages: EscrowCaseMessage[] }).messages ?? [])

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

  async function handleSendReply() {
    const content = replyValue.trim()
    if (!selectedId || !content || replyPending) return
    setReplyPending(true)
    try {
      const res = await fetch(`/api/admin/escrow-cases/${selectedId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to send message")
      setReplyValue("")
      await fetchCase()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send message")
    } finally {
      setReplyPending(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-extrabold tracking-[-0.02em] text-[#17161c]">Escrow Cases</h1>
        <button
          type="button"
          onClick={() => setNewCaseOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-[9px] bg-[#7c3aed] px-3.5 text-[13px] font-bold text-white hover:bg-[#6d28d9]"
        >
          <Plus className="size-4" /> New Case
        </button>
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
          canReply
        />
      </div>
      <NewEscrowCaseDialog
        open={newCaseOpen}
        onOpenChange={setNewCaseOpen}
        onCreated={(caseId) => void refreshCases(caseId)}
      />
    </div>
  )
}

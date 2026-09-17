"use client"

import { Fragment } from "react"
import { Loader2, RotateCcw, UserCog } from "lucide-react"
import { cn } from "@/lib/utils"
import { ParticipantAvatar } from "@/features/messages/components/triage/ParticipantAvatar"
import { formatMoneyMinor } from "@/features/escrow-cases/lib/money"
import { getValidNextStates, type EscrowCaseState } from "@/features/escrow-cases/lib/state-machine"
import { ESCROW_CASE_STATE_LABELS, type EscrowCaseDetail, type EscrowCaseMessage } from "@/features/escrow-cases/types"

// Same visual language as features/messages/components/triage/ReadingPane.tsx (purple
// #7c3aed accent, Plus Jakarta Sans) — see the plan's deviation note: Queue Console's
// dark-rail/gold system explicitly scopes itself out of every screen but its own three,
// and this feature's real host surface (Messages Triage) already uses the site default.
// Not a literal reuse of ReadingPane itself: that component is tightly coupled to a
// 2-party conversation and moderation actions (Flag/Delete/Resolve) that don't apply to
// a 3-party case thread with its own state-driven actions.

type Props = {
  caseDetail: EscrowCaseDetail | null
  messages: EscrowCaseMessage[]
  messagesLoading: boolean
  messagesError: string | null
  onRetry: () => void
  currentUserId: string
  replyValue: string
  onReplyChange: (value: string) => void
  onSendReply: () => void
  replyPending?: boolean
  /** false for the read-only "moderation" oversight scope — see requireEscrowThreadWriteAccess. */
  canReply: boolean
  onTransition: (toState: EscrowCaseState) => void
  transitionPending?: boolean
  /** true only for scope "supervisor"/"admin" — see requireEscrowCaseAccess. */
  canReassign: boolean
  onOpenReassign: () => void
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function dayKey(iso: string) {
  return new Date(iso).toDateString()
}

export function EscrowCaseThreadView({
  caseDetail,
  messages,
  messagesLoading,
  messagesError,
  onRetry,
  currentUserId,
  replyValue,
  onReplyChange,
  onSendReply,
  replyPending,
  canReply,
  onTransition,
  transitionPending,
  canReassign,
  onOpenReassign,
}: Props) {
  if (!caseDetail) {
    return (
      <div className="flex min-w-[560px] flex-1 items-center justify-center bg-[#fbfbfd] text-sm text-[#8b8a99]">
        Select a case to view its thread.
      </div>
    )
  }

  function whoName(senderId: string | null): string {
    if (senderId === null) return "System"
    if (senderId === caseDetail!.buyerId) return caseDetail!.buyer.name
    if (senderId === caseDetail!.sellerId) return caseDetail!.seller.name
    if (senderId === caseDetail!.assignedAgentId) return caseDetail!.agentName ?? "Agent"
    return "Unknown"
  }

  const nextStates = getValidNextStates(caseDetail.state)

  return (
    <div className="flex min-w-[560px] flex-1 flex-col bg-[#fbfbfd]">
      <div className="flex flex-none flex-wrap items-center gap-3 border-b border-[#ececf3] bg-white px-5 py-3.5">
        <div className="flex">
          <ParticipantAvatar id={caseDetail.buyerId} name={caseDetail.buyer.name} size={34} />
          <ParticipantAvatar
            id={caseDetail.sellerId}
            name={caseDetail.seller.name}
            size={34}
            style={{ marginLeft: -10, border: "2px solid #fff" }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15.5px] font-extrabold tracking-[-0.02em] text-[#17161c]">
            {caseDetail.buyer.name} ↔ {caseDetail.seller.name}
          </div>
          <div className="truncate text-[12.5px] text-[#8b8a99]">
            {caseDetail.listingTitle ?? "Listing"} · {formatMoneyMinor(caseDetail.agreedPriceMinor, caseDetail.currency)}
            {" · Agent: "}
            {caseDetail.agentName ?? "Unassigned"}
          </div>
        </div>
        <div className="flex-1" />
        {canReassign && (
          <button
            type="button"
            onClick={onOpenReassign}
            className="flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-[#e3e3ec] bg-white px-3.5 text-[13px] font-semibold text-[#3d3c49] hover:border-[#cfcfe0]"
          >
            <UserCog className="size-3.5" /> Reassign
          </button>
        )}
        {canReply && nextStates.length > 0 ? (
          <select
            value=""
            disabled={transitionPending}
            onChange={(e) => {
              const value = e.target.value as EscrowCaseState
              if (value) onTransition(value)
            }}
            className="h-[34px] whitespace-nowrap rounded-[9px] bg-[#f2edff] px-[9px] text-[11.5px] font-bold text-[#6d28d9]"
          >
            <option value="">{ESCROW_CASE_STATE_LABELS[caseDetail.state]}</option>
            {nextStates.map((s) => (
              <option key={s} value={s}>
                Move to: {ESCROW_CASE_STATE_LABELS[s]}
              </option>
            ))}
          </select>
        ) : (
          <span className="whitespace-nowrap rounded-md bg-[#f2edff] px-[9px] py-1 text-[11.5px] font-bold text-[#6d28d9]">
            {ESCROW_CASE_STATE_LABELS[caseDetail.state]}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {messagesLoading && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-[#9a99a8]" />
          </div>
        )}
        {!messagesLoading && messagesError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="text-sm font-semibold text-[#b91c1c]">{messagesError}</div>
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-1.5 rounded-[9px] border border-[#e3e3ec] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#3d3c49] hover:border-[#cfcfe0]"
            >
              <RotateCcw className="size-3.5" /> Retry
            </button>
          </div>
        )}
        {!messagesLoading && !messagesError && messages.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-sm text-[#8b8a99]">
            No messages in this case yet.
          </div>
        )}
        {!messagesLoading &&
          !messagesError &&
          messages.map((m, msgIndex) => {
            const showDateDivider =
              msgIndex === 0 || dayKey(m.createdAt) !== dayKey(messages[msgIndex - 1]!.createdAt)
            const mine = m.senderId === currentUserId
            const isSystem = m.kind === "system"
            return (
              <Fragment key={m.id}>
                {showDateDivider && (
                  <div className="self-center rounded-full bg-[#f1f1f6] px-[11px] py-1 text-[11.5px] text-[#9a99a8]">
                    {formatDateLabel(m.createdAt)}
                  </div>
                )}
                {isSystem ? (
                  <div className="self-center rounded-full bg-[#f5f4f9] px-3 py-1 text-[12px] text-[#6b6a78]">
                    {m.content}
                  </div>
                ) : (
                  <div className={cn("max-w-[64%]", mine ? "self-end text-right" : "self-start text-left")}>
                    <div className="mb-1 text-[11.5px] text-[#9a99a8]">
                      {whoName(m.senderId)} · {formatTime(m.createdAt)}
                    </div>
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-[1.5]",
                        mine ? "bg-[#7c3aed] text-white" : "bg-white text-[#2c2b36]",
                        mine ? "border border-[#7c3aed]" : "border border-[#ececf3]"
                      )}
                    >
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    </div>
                  </div>
                )}
              </Fragment>
            )
          })}
      </div>

      <form
        className="flex flex-none flex-col gap-2 border-t border-[#ececf3] bg-white px-5 py-3"
        onSubmit={(e) => {
          e.preventDefault()
          onSendReply()
        }}
      >
        <div className="flex items-center gap-2.5">
          <span className="w-[62px] flex-none text-xs font-bold tracking-[0.05em] text-[#9a99a8]">REPLY</span>
          <input
            name="case-reply"
            value={replyValue}
            onChange={(e) => onReplyChange(e.target.value)}
            disabled={!canReply || replyPending}
            placeholder={canReply ? "Message the case thread…" : "Read-only (oversight)"}
            className="h-[38px] flex-1 rounded-[10px] border border-[#e6e6ee] bg-[#fbfbfd] px-3 text-[13px] text-[#17161c] outline-none placeholder:text-[#9a99a8] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!canReply || replyPending || !replyValue.trim()}
            className="h-[38px] whitespace-nowrap rounded-[10px] bg-[#7c3aed] px-3.5 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {replyPending ? "Sending…" : "Send ⌘⏎"}
          </button>
        </div>
      </form>
    </div>
  )
}

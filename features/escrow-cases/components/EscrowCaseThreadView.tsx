"use client"

import { Fragment, useRef, useState } from "react"
import { File as FileIcon, FolderOpen, Loader2, Lock, MessageSquareText, Paperclip, RotateCcw, UserCog, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ParticipantAvatar } from "@/features/messages/components/triage/ParticipantAvatar"
import { formatMoneyMinor } from "@/features/escrow-cases/lib/money"
import { getValidNextStates, type EscrowCaseState } from "@/features/escrow-cases/lib/state-machine"
import {
  ESCROW_CASE_MESSAGE_VISIBILITY_LABELS,
  ESCROW_CASE_STATE_LABELS,
  type EscrowCaseAttachment,
  type EscrowCaseDetail,
  type EscrowCaseMessage,
  type EscrowCaseMessageVisibility,
  type EscrowCannedResponse,
} from "@/features/escrow-cases/types"

// Must match app/api/chat/media's ALLOWED_MEDIA_TYPES minus audio — evidence is
// photos/documents, not voice notes (also matches the server's own
// ALLOWED_EVIDENCE_TYPES in app/api/admin/escrow-cases/[id]/messages/route.ts).
const ATTACH_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

// Same visual language as features/messages/components/triage/ReadingPane.tsx (purple
// #7c3aed accent, Plus Jakarta Sans) — see the plan's deviation note: Queue Console's
// dark-rail/gold system explicitly scopes itself out of every screen but its own three,
// and this feature's real host surface (Messages Triage) already uses the site default.
// Not a literal reuse of ReadingPane itself: that component is tightly coupled to a
// 2-party conversation and moderation actions (Flag/Delete/Resolve) that don't apply to
// a 3-party case thread with its own state-driven actions.

type PendingAttachment = { file: File; previewUrl: string | null }

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
  replyChannel: EscrowCaseMessageVisibility
  onReplyChannelChange: (channel: EscrowCaseMessageVisibility) => void
  /** false for the read-only "moderation" oversight scope — see requireEscrowThreadWriteAccess. */
  canReply: boolean
  onTransition: (toState: EscrowCaseState) => void
  transitionPending?: boolean
  /** true only for scope "supervisor"/"admin" — see requireEscrowCaseAccess. */
  canReassign: boolean
  onOpenReassign: () => void
  pendingAttachment: PendingAttachment | null
  onPickAttachment: (files: FileList | null) => void
  onRemoveAttachment: () => void
  attachmentUploading?: boolean
  cannedResponses: EscrowCannedResponse[]
  onInsertCannedResponse: (bodyEn: string) => void
  attachments: EscrowCaseAttachment[]
  showEvidence: boolean
  onToggleEvidence: () => void
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
  replyChannel,
  onReplyChannelChange,
  canReply,
  onTransition,
  transitionPending,
  canReassign,
  onOpenReassign,
  pendingAttachment,
  onPickAttachment,
  onRemoveAttachment,
  attachmentUploading,
  cannedResponses,
  onInsertCannedResponse,
  attachments,
  showEvidence,
  onToggleEvidence,
}: Props) {
  const [cannedOpen, setCannedOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        <button
          type="button"
          onClick={onToggleEvidence}
          className={cn(
            "flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-[9px] border px-3.5 text-[13px] font-semibold",
            showEvidence
              ? "border-[#7c3aed] bg-[#f2edff] text-[#6d28d9]"
              : "border-[#e3e3ec] bg-white text-[#3d3c49] hover:border-[#cfcfe0]"
          )}
        >
          <FolderOpen className="size-3.5" /> Evidence ({attachments.length})
        </button>
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

      {showEvidence && (
        <div className="flex flex-none flex-wrap gap-2 border-b border-[#ececf3] bg-[#fbfbfd] px-5 py-3">
          {attachments.length === 0 ? (
            <span className="text-[12.5px] text-[#8b8a99]">
              No evidence recorded for this case yet — photos, certificates, and payment
              slips shared in the thread show up here automatically.
            </span>
          ) : (
            attachments.map((a) =>
              a.fileType === "image" ? (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.label ?? ""} className="size-16 rounded-lg object-cover" />
                </a>
              ) : (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-[#e6e6ee] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#3d3c49] hover:border-[#cfcfe0]"
                >
                  <FileIcon className="size-3.5" /> {a.label || "Evidence file"}
                </a>
              )
            )
          )}
        </div>
      )}

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
                    <div className="mb-1 flex items-center gap-1.5 text-[11.5px] text-[#9a99a8]">
                      {m.visibility !== "case" && (
                        <span
                          className={cn(
                            "flex items-center gap-1 rounded-md px-[6px] py-[1px] text-[10.5px] font-bold",
                            mine ? "order-2" : "order-first"
                          )}
                          style={{ background: "#fef3c7", color: "#92400e" }}
                        >
                          <Lock className="size-2.5" /> {ESCROW_CASE_MESSAGE_VISIBILITY_LABELS[m.visibility]}
                        </span>
                      )}
                      <span>
                        {whoName(m.senderId)} · {formatTime(m.createdAt)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-[1.5]",
                        m.visibility !== "case"
                          ? "border border-[#f59e0b] bg-[#fffbeb] text-[#2c2b36]"
                          : mine
                            ? "border border-[#7c3aed] bg-[#7c3aed] text-white"
                            : "border border-[#ececf3] bg-white text-[#2c2b36]"
                      )}
                    >
                      {m.fileUrl &&
                        (m.attachmentType === "image" ? (
                          <a href={m.fileUrl} target="_blank" rel="noreferrer" className="mb-1 block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.fileUrl} alt="" className="max-h-40 rounded-lg object-cover" />
                          </a>
                        ) : (
                          <a
                            href={m.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                              "mb-1 flex items-center gap-1.5 underline",
                              mine && m.visibility === "case" ? "text-white" : "text-[#3d3c49]"
                            )}
                          >
                            <FileIcon className="size-3.5" /> Attachment
                          </a>
                        ))}
                      {m.content && <span className="whitespace-pre-wrap">{m.content}</span>}
                    </div>
                  </div>
                )}
              </Fragment>
            )
          })}
      </div>

      <form
        className="relative flex flex-none flex-col gap-2 border-t border-[#ececf3] bg-white px-5 py-3"
        onSubmit={(e) => {
          e.preventDefault()
          onSendReply()
        }}
      >
        {canReply && (
          <div className="flex items-center gap-1.5 pl-[74px]">
            {(["case", "agent_buyer", "agent_seller"] as const).map((channel) => (
              <button
                key={channel}
                type="button"
                onClick={() => onReplyChannelChange(channel)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-[9px] py-[3px] text-[11px] font-bold transition-colors",
                  replyChannel === channel
                    ? channel === "case"
                      ? "bg-[#f2edff] text-[#6d28d9]"
                      : "bg-[#fef3c7] text-[#92400e]"
                    : "text-[#9a99a8] hover:bg-[#f5f4f9]"
                )}
              >
                {channel !== "case" && <Lock className="size-2.5" />}
                {ESCROW_CASE_MESSAGE_VISIBILITY_LABELS[channel]}
              </button>
            ))}
          </div>
        )}
        {pendingAttachment && (
          <div className="flex items-center gap-1.5 pl-[74px]">
            <div className="flex items-center gap-1.5 rounded-[9px] border border-[#e6e6ee] bg-[#fbfbfd] py-1 pl-1.5 pr-2 text-[12px] text-[#3d3c49]">
              {pendingAttachment.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pendingAttachment.previewUrl} alt="" className="size-7 rounded-[6px] object-cover" />
              ) : (
                <FileIcon className="size-4 flex-none text-[#9a99a8]" />
              )}
              <span className="max-w-[180px] truncate">{pendingAttachment.file.name}</span>
              <button
                type="button"
                onClick={onRemoveAttachment}
                disabled={replyPending}
                aria-label="Remove attachment"
                className="grid size-4 flex-none place-items-center rounded-full text-[#9a99a8] hover:bg-[#ececf3] disabled:opacity-50"
              >
                <X className="size-3" />
              </button>
            </div>
          </div>
        )}
        {cannedOpen && (
          <div className="absolute bottom-full left-[74px] z-10 mb-1 max-h-64 w-80 overflow-y-auto rounded-xl border border-[#e6e6ee] bg-white py-1.5 shadow-lg">
            {cannedResponses.length === 0 ? (
              <div className="px-3.5 py-2 text-[12.5px] text-[#8b8a99]">No canned responses configured.</div>
            ) : (
              cannedResponses.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onInsertCannedResponse(r.bodyEn)
                    setCannedOpen(false)
                  }}
                  className="block w-full px-3.5 py-2 text-left hover:bg-[#f7f4ff]"
                >
                  <div className="text-[13px] font-bold text-[#17161c]">{r.title}</div>
                  <div className="truncate text-[12px] text-[#8b8a99]">{r.bodyEn}</div>
                </button>
              ))
            )}
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <span className="w-[62px] flex-none text-xs font-bold tracking-[0.05em] text-[#9a99a8]">REPLY</span>
          <input
            ref={fileInputRef}
            type="file"
            accept={ATTACH_ACCEPT}
            className="hidden"
            onChange={(e) => {
              onPickAttachment(e.target.files)
              e.target.value = ""
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canReply || replyPending || attachmentUploading || !!pendingAttachment}
            aria-label="Attach evidence"
            className="grid size-[38px] flex-none place-items-center rounded-[10px] border border-[#e6e6ee] text-[#6b6a78] hover:bg-[#f5f4f9] disabled:opacity-50"
          >
            <Paperclip className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setCannedOpen((v) => !v)}
            disabled={!canReply || replyPending}
            aria-label="Insert canned response"
            className={cn(
              "grid size-[38px] flex-none place-items-center rounded-[10px] border text-[#6b6a78] hover:bg-[#f5f4f9] disabled:opacity-50",
              cannedOpen ? "border-[#7c3aed] bg-[#f2edff] text-[#6d28d9]" : "border-[#e6e6ee]"
            )}
          >
            <MessageSquareText className="size-4" />
          </button>
          <input
            name="case-reply"
            value={replyValue}
            onChange={(e) => onReplyChange(e.target.value)}
            disabled={!canReply || replyPending}
            placeholder={
              !canReply
                ? "Read-only (oversight)"
                : replyChannel === "agent_buyer"
                  ? `Message ${caseDetail.buyer.name} privately…`
                  : replyChannel === "agent_seller"
                    ? `Message ${caseDetail.seller.name} privately…`
                    : "Message the case thread…"
            }
            className="h-[38px] flex-1 rounded-[10px] border border-[#e6e6ee] bg-[#fbfbfd] px-3 text-[13px] text-[#17161c] outline-none placeholder:text-[#9a99a8] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!canReply || replyPending || (!replyValue.trim() && !pendingAttachment)}
            className={cn(
              "h-[38px] whitespace-nowrap rounded-[10px] px-3.5 text-[13px] font-bold text-white disabled:opacity-50",
              replyChannel === "case" ? "bg-[#7c3aed]" : "bg-[#b45309]"
            )}
          >
            {attachmentUploading ? "Uploading…" : replyPending ? "Sending…" : "Send ⌘⏎"}
          </button>
        </div>
      </form>
    </div>
  )
}

"use client"

import { Fragment, useState } from "react"
import { CheckCircle2, Flag, Loader2, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ImageViewer } from "@/components/shared/ImageViewer"
import { ParticipantAvatar } from "@/features/messages/components/triage/ParticipantAvatar"
import { TYPE_LABELS } from "@/features/messages/lib/triage-filters"
import type { TriageConversation, TriageThread } from "@/features/messages/types/triage"

type Props = {
  conversation: TriageConversation | null
  thread: TriageThread | null
  threadLoading: boolean
  threadError: string | null
  onRetryThread: () => void
  noteValue: string
  onNoteChange: (value: string) => void
  onSaveNote: () => void
  onFlag: () => void
  onDelete: () => void
  onResolve: () => void
  onOverflow: () => void
  flagPending?: boolean
  deletePending?: boolean
  replyValue: string
  onReplyChange: (value: string) => void
  onSendReply: () => void
  replyPending?: boolean
  /** Name of the other participant a reply would be sent to, or null when the
   *  logged-in user isn't a participant in this conversation (oversight-only). */
  replyTargetName: string | null
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

// Thread ids are display-only here — pad the numeric part of the mock id so
// it reads like a real ticket number (e.g. "c6" -> "#0006").
function threadNumber(id: string) {
  return (id.match(/\d+/)?.[0] ?? "0").padStart(4, "0")
}

export function ReadingPane({
  conversation,
  thread,
  threadLoading,
  threadError,
  onRetryThread,
  noteValue,
  onNoteChange,
  onSaveNote,
  onFlag,
  onDelete,
  onResolve,
  onOverflow,
  flagPending,
  deletePending,
  replyValue,
  onReplyChange,
  onSendReply,
  replyPending,
  replyTargetName,
}: Props) {
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null)

  if (!conversation) {
    return (
      <div className="flex min-w-[560px] flex-1 items-center justify-center bg-[#fbfbfd] text-sm text-[#8b8a99]">
        Select a conversation to view its messages.
      </div>
    )
  }

  const { participantA, participantB } = conversation

  return (
    <div className="flex min-w-[560px] flex-1 flex-col bg-[#fbfbfd]">
      <div className="flex flex-none flex-wrap items-center gap-3 border-b border-[#ececf3] bg-white px-5 py-3.5">
        <div className="flex">
          <ParticipantAvatar id={participantA.id} name={participantA.name} size={34} />
          <ParticipantAvatar
            id={participantB.id}
            name={participantB.name}
            size={34}
            style={{ marginLeft: -10, border: "2px solid #fff" }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15.5px] font-extrabold tracking-[-0.02em] text-[#17161c]">
            {participantA.name} ↔ {participantB.name}
          </div>
          <div className="truncate text-[12.5px] text-[#8b8a99]">
            {conversation.messageCount} messages · {TYPE_LABELS[conversation.type]} · thread #
            {threadNumber(conversation.id)}
          </div>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onFlag}
          disabled={flagPending}
          className="flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-[#e3e3ec] bg-white px-3.5 text-[13px] font-semibold text-[#3d3c49] transition-colors hover:border-[#cfcfe0] disabled:opacity-50"
        >
          <Flag className="size-3.5" /> Flag <span className="text-[#a8a7b5]">F</span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deletePending}
          className="flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-[#f3c9c9] bg-white px-3.5 text-[13px] font-semibold text-[#b91c1c] transition-colors hover:bg-[#fff7f7] disabled:opacity-50"
        >
          <Trash2 className="size-3.5" /> Delete
        </button>
        <button
          type="button"
          onClick={onResolve}
          className="flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-[#7c3aed] px-3.5 text-[13px] font-bold text-white transition-colors hover:bg-[#6d28d9]"
        >
          <CheckCircle2 className="size-3.5" /> Resolve <span className="opacity-70">E</span>
        </button>
        <button
          type="button"
          onClick={onOverflow}
          aria-label="More actions"
          className="grid size-[34px] place-items-center rounded-[9px] text-[#6b6a78] transition-colors hover:bg-[#f5f4f9]"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      {conversation.risk && (
        <div className="mx-5 mt-3.5 flex flex-none items-center gap-3 rounded-xl border border-[#fde4c8] bg-[#fffaf2] px-3.5 py-2.5">
          <span className="text-[11.5px] font-extrabold tracking-[0.05em] text-[#b45309]">
            POLICY {conversation.risk.policyId} · {conversation.risk.policyLabel}
          </span>
          <span className="text-[12.5px] text-[#6b5a45]">
            Confidence {conversation.risk.confidence} · {conversation.risk.detail}
          </span>
          <div className="flex-1" />
          <span className="cursor-pointer text-[12.5px] font-bold text-[#b45309]">Review policy →</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {threadLoading && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-[#9a99a8]" />
          </div>
        )}
        {!threadLoading && threadError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="text-sm font-semibold text-[#b91c1c]">{threadError}</div>
            <button
              type="button"
              onClick={onRetryThread}
              className="flex items-center gap-1.5 rounded-[9px] border border-[#e3e3ec] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#3d3c49] hover:border-[#cfcfe0]"
            >
              <RotateCcw className="size-3.5" /> Retry
            </button>
          </div>
        )}
        {!threadLoading && !threadError && thread && (
          <>
            {thread.messages.map((m, msgIndex) => {
              const showDateDivider =
                msgIndex === 0 || dayKey(m.sentAt) !== dayKey(thread.messages[msgIndex - 1]!.sentAt)
              return (
                <Fragment key={m.id}>
                  {showDateDivider && (
                    <div className="self-center rounded-full bg-[#f1f1f6] px-[11px] py-1 text-[11.5px] text-[#9a99a8]">
                      {formatDateLabel(m.sentAt)}
                    </div>
                  )}
                  <div className={cn("max-w-[64%]", m.mine ? "self-end text-right" : "self-start text-left")}>
                    <div className="mb-1 text-[11.5px] text-[#9a99a8]">
                      {m.who} · {formatTime(m.sentAt)}
                    </div>
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-[1.5]",
                        m.mine ? "bg-[#7c3aed] text-white" : "bg-white text-[#2c2b36]",
                        m.flagged
                          ? "border border-[#f59e0b]"
                          : m.mine
                            ? "border border-[#7c3aed]"
                            : "border border-[#ececf3]"
                      )}
                    >
                      {(() => {
                        const images =
                          m.imageUrls && m.imageUrls.length > 0
                            ? m.imageUrls
                            : m.messageType === "image" && m.fileUrl
                              ? [m.fileUrl]
                              : null
                        if (images) {
                          return (
                            <div className="mb-1 flex flex-wrap gap-1">
                              {images.map((url, i) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={url}
                                  src={url}
                                  alt=""
                                  onClick={() => setViewer({ images, index: i })}
                                  className="h-24 w-24 cursor-zoom-in rounded-lg object-cover"
                                />
                              ))}
                            </div>
                          )
                        }
                        if (m.messageType === "audio" && m.fileUrl) {
                          return <audio controls src={m.fileUrl} className="max-w-full" />
                        }
                        if (m.fileUrl && !m.text) {
                          return (
                            <a
                              href={m.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={cn("underline", m.mine ? "text-white" : "text-[#2c2b36]")}
                            >
                              Attachment
                            </a>
                          )
                        }
                        return null
                      })()}
                      {m.text && <span className="whitespace-pre-wrap">{m.text}</span>}
                    </div>
                    {m.flagged && (
                      <div className="mt-1 text-[11.5px] font-bold text-[#b45309]">⚑ flagged by system</div>
                    )}
                  </div>
                </Fragment>
              )
            })}
          </>
        )}
      </div>

      <form
        className="flex flex-none items-center gap-2.5 border-t border-[#ececf3] bg-white px-5 py-3"
        onSubmit={(e) => {
          e.preventDefault()
          onSendReply()
        }}
      >
        <span className="w-[62px] flex-none text-xs font-bold tracking-[0.05em] text-[#9a99a8]">REPLY</span>
        <input
          name="reply"
          value={replyValue}
          onChange={(e) => onReplyChange(e.target.value)}
          disabled={!replyTargetName || replyPending}
          placeholder={
            replyTargetName ? `Reply to ${replyTargetName}…` : "You're not a participant in this conversation"
          }
          className="h-[38px] flex-1 rounded-[10px] border border-[#e6e6ee] bg-[#fbfbfd] px-3 text-[13px] text-[#17161c] outline-none placeholder:text-[#9a99a8] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!replyTargetName || !replyValue.trim() || replyPending}
          className="h-[38px] whitespace-nowrap rounded-[10px] bg-[#7c3aed] px-3.5 text-[13px] font-bold text-white disabled:opacity-50"
        >
          {replyPending ? "Sending…" : "Send ⌘⏎"}
        </button>
      </form>

      <div className="flex flex-none items-center gap-2.5 border-t border-[#ececf3] bg-white px-5 py-3">
        <span className="w-[62px] flex-none text-xs font-bold tracking-[0.05em] text-[#9a99a8]">INTERNAL</span>
        <input
          name="internal-note"
          value={noteValue}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Add a note — visible to admins only"
          className="h-[38px] flex-1 rounded-[10px] border border-[#e6e6ee] bg-[#fbfbfd] px-3 text-[13px] text-[#17161c] outline-none placeholder:text-[#9a99a8]"
        />
        <button
          type="button"
          onClick={onSaveNote}
          className="h-[38px] whitespace-nowrap rounded-[10px] bg-[#17161c] px-3.5 text-[13px] font-bold text-white"
        >
          Save ⌘⏎
        </button>
      </div>

      {viewer && (
        <ImageViewer images={viewer.images} initialIndex={viewer.index} onClose={() => setViewer(null)} />
      )}
    </div>
  )
}

"use client"

import { Download, List as ListIcon, Plus, Rows3 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ListMode } from "@/features/messages/types/triage"

type Props = {
  mode: ListMode
  onModeChange: (mode: ListMode) => void
  conversationCount: number
  messageCount: number
  onExport: () => void
  onNewMessage: () => void
}

export function TriageHeader({
  mode,
  onModeChange,
  conversationCount,
  messageCount,
  onExport,
  onNewMessage,
}: Props) {
  const countLabel =
    mode === "conversations"
      ? `${conversationCount} conversations · ${messageCount} messages`
      : `${messageCount} messages`

  return (
    <div className="flex-none border-b border-[#ececf3] bg-white px-6 pb-3.5 pt-[18px]">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-[280px] flex-1">
          <div className="flex items-center gap-[11px]">
            <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.03em] text-[#17161c]">Messages</h1>
            <span className="rounded-lg bg-[#f1ecff] px-2.5 py-1 text-xs font-bold text-[#6d28d9]">
              {countLabel}
            </span>
          </div>
          <p className="mt-1.5 text-[13.5px] text-[#6b6a78]">
            Conversation oversight and message moderation in one place.
          </p>
        </div>

        <div className="flex flex-none items-center gap-2.5">
          <div className="flex gap-0.5 rounded-[10px] bg-[#f3f3f8] p-[3px]">
            <button
              type="button"
              onClick={() => onModeChange("conversations")}
              className={cn(
                "flex h-8 items-center gap-[7px] rounded-lg px-3.5 text-[13px] transition-colors duration-[120ms]",
                mode === "conversations" ? "bg-white font-bold text-[#17161c]" : "font-semibold text-[#8b8a99]"
              )}
            >
              <Rows3 className="size-[15px]" /> Conversations
            </button>
            <button
              type="button"
              onClick={() => onModeChange("messages")}
              className={cn(
                "flex h-8 items-center gap-[7px] rounded-lg px-3.5 text-[13px] transition-colors duration-[120ms]",
                mode === "messages" ? "bg-white font-bold text-[#17161c]" : "font-semibold text-[#8b8a99]"
              )}
            >
              <ListIcon className="size-[15px]" /> All messages
            </button>
          </div>

          <button
            type="button"
            onClick={onExport}
            className="flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#e3e3ec] bg-white px-3.5 text-[13.5px] font-semibold text-[#3d3c49] transition-colors hover:border-[#cfcfe0]"
          >
            <Download className="size-4" /> Export
          </button>
          <button
            type="button"
            onClick={onNewMessage}
            className="flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#7c3aed] px-4 text-[13.5px] font-bold text-white transition-colors hover:bg-[#6d28d9]"
          >
            <Plus className="size-4" /> New message
          </button>
        </div>
      </div>
    </div>
  )
}

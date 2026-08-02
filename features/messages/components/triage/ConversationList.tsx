"use client"

import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { ParticipantAvatar } from "@/features/messages/components/triage/ParticipantAvatar"
import type { ListMode } from "@/features/messages/types/triage"

const TAG_COLORS: Record<string, [string, string]> = {
  "OFF-PLATFORM": ["#b91c1c", "#fee2e2"],
  ESCROW: ["#0369a1", "#e0f2fe"],
  REPORTED: ["#b45309", "#fef3c7"],
  DELETED: ["#6b6a78", "#f1f1f6"],
  SYSTEM: ["#6b6a78", "#f1f1f6"],
}

export type TriageListRow = {
  id: string
  avatarId: string
  avatarName: string
  title: string
  preview: string
  time: string
  meta?: string
  tag?: string
  selected: boolean
}

type Props = {
  mode: ListMode
  query: string
  onQueryChange: (value: string) => void
  sortDesc: boolean
  onToggleSort: () => void
  resultLabel: string
  rows: TriageListRow[]
  onSelectRow: (id: string) => void
}

export function ConversationList({
  mode,
  query,
  onQueryChange,
  sortDesc,
  onToggleSort,
  resultLabel,
  rows,
  onSelectRow,
}: Props) {
  return (
    <div className="flex w-[392px] flex-none flex-col border-r border-[#ececf3] bg-white">
      <div className="flex-none border-b border-[#f0f0f5] p-3.5">
        <label className="flex h-9 items-center gap-2.5 rounded-[9px] border border-[#e6e6ee] bg-[#fbfbfd] px-[11px] text-[13px] text-[#8b8a99]">
          <Search className="size-4 shrink-0" />
          <input
            name="triage-search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={
              mode === "conversations" ? "Search conversations, participants…" : "Search message text, SKU…"
            }
            className="min-w-0 flex-1 bg-transparent text-[#17161c] outline-none placeholder:text-[#8b8a99]"
          />
          <span className="rounded border border-[#e6e6ee] bg-white px-1.5 py-px text-[11px] text-[#8b8a99]">/</span>
        </label>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-xs font-bold text-[#3d3c49]">{resultLabel}</span>
          <div className="flex-1" />
          <button type="button" onClick={onToggleSort} className="cursor-pointer text-xs text-[#6b6a78]">
            {sortDesc ? "Newest" : "Oldest"} ▾
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((row) => {
          const tagColors = row.tag ? TAG_COLORS[row.tag] : undefined
          return (
            <div
              key={row.id}
              onClick={() => onSelectRow(row.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelectRow(row.id)
              }}
              className={cn(
                "flex cursor-pointer gap-[11px] border-b border-l-[3px] border-[#f4f4f8] px-3.5 py-3 transition-colors duration-[120ms]",
                row.selected ? "border-l-[#7c3aed] bg-[#f7f4ff]" : "border-l-transparent bg-white hover:bg-[#fafaff]"
              )}
            >
              <ParticipantAvatar id={row.avatarId} name={row.avatarName} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13.5px] font-bold tracking-[-0.01em] text-[#17161c]">
                    {row.title}
                  </span>
                  <span className="ml-auto whitespace-nowrap text-[11.5px] text-[#9a99a8]">{row.time}</span>
                </div>
                <div className="mt-[3px] truncate text-[13px] text-[#4a4956]">{row.preview}</div>
                {(row.tag || row.meta) && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {row.tag && (
                      <span
                        className="rounded-md px-[7px] py-0.5 text-[10.5px] font-bold"
                        style={{ color: tagColors?.[0] ?? "#6b6a78", background: tagColors?.[1] ?? "#f1f1f6" }}
                      >
                        {row.tag}
                      </span>
                    )}
                    {row.meta && <span className="text-[11.5px] text-[#9a99a8]">{row.meta}</span>}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {rows.length === 0 && (
          <div className="px-6 py-[52px] text-center">
            <div className="text-sm font-bold text-[#3d3c49]">No matches</div>
            <div className="mt-1 text-[13px] text-[#8b8a99]">Try a different term or switch view.</div>
          </div>
        )}
      </div>
    </div>
  )
}

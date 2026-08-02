"use client"

import { CheckCircle2, CircleDot, Clock, Flag, UserCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { STATUS_FILTERS, STATUS_LABELS, TYPE_FILTERS, TYPE_LABELS } from "@/features/messages/lib/triage-filters"
import type { StatusFilter, TriageFacetCounts, TypeFilter } from "@/features/messages/types/triage"

const STATUS_ICONS: Record<StatusFilter, React.ElementType> = {
  all: CircleDot,
  flagged: Flag,
  awaiting: Clock,
  mine: UserCheck,
  resolved: CheckCircle2,
}

type Props = {
  status: StatusFilter
  type: TypeFilter
  facets: TriageFacetCounts
  onStatusChange: (status: StatusFilter) => void
  onTypeChange: (type: TypeFilter) => void
  slaText: string
}

export function FilterRails({ status, type, facets, onStatusChange, onTypeChange, slaText }: Props) {
  return (
    <div className="flex w-[212px] flex-none flex-col gap-[3px] overflow-y-auto border-r border-[#ececf3] bg-[#fcfcfe] p-2.5">
      <div className="px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#9a99a8]">Status</div>
      {STATUS_FILTERS.map((s) => {
        const Icon = STATUS_ICONS[s]
        const selected = status === s
        return (
          <button
            key={s}
            type="button"
            onClick={() => onStatusChange(s)}
            className={cn(
              "flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[13.5px] transition-colors duration-[120ms]",
              selected ? "bg-[#f2edff] font-bold text-[#6d28d9]" : "font-semibold text-[#4a4956] hover:bg-[#f4f3f9]"
            )}
          >
            <Icon className="size-4 shrink-0 opacity-80" />
            <span className="flex-1">{STATUS_LABELS[s]}</span>
            <span className={cn("text-[11.5px] font-bold", selected ? "text-[#6d28d9]" : "text-[#9a99a8]")}>
              {facets.status[s]}
            </span>
          </button>
        )
      })}

      <div className="px-2.5 pb-1.5 pt-[18px] text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#9a99a8]">
        Type
      </div>
      {TYPE_FILTERS.map((t) => {
        const selected = type === t
        return (
          <button
            key={t}
            type="button"
            onClick={() => onTypeChange(t)}
            className={cn(
              "flex items-center rounded-[9px] px-2.5 py-[7px] text-left text-[13.5px] transition-colors duration-[120ms]",
              selected ? "bg-[#f2edff] font-bold text-[#6d28d9]" : "font-medium text-[#4a4956] hover:bg-[#f4f3f9]"
            )}
          >
            <span className="flex-1">{TYPE_LABELS[t]}</span>
            <span className="text-[11.5px] text-[#9a99a8]">{facets.type[t]}</span>
          </button>
        )
      })}

      <div className="mt-auto rounded-[11px] border border-dashed border-[#ded9f5] bg-[#faf8ff] p-3">
        <div className="text-[11.5px] font-bold tracking-[0.05em] text-[#5b21b6]">SLA</div>
        <div className="mt-1 text-xs leading-[1.45] text-[#6b6a78]">{slaText}</div>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, CalendarDays } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { saveMonthlyBonusSettingsAction } from "@/features/points/actions/points"
import { cn } from "@/lib/utils"

/** Client-safe copies — do not import from features/points/db/* (pulls Node `tls`). */
const MONTHLY_BONUS_CYCLE_OPTIONS = [1, 3, 6, 12] as const
type MonthlyBonusCycles = (typeof MONTHLY_BONUS_CYCLE_OPTIONS)[number]

type MonthlyBonusSettings = {
  enabled: boolean
  amount: number
  cycles: MonthlyBonusCycles
  startDate: string | null
}

type ScheduleItem = {
  cycle: number
  dueDate: string
  label: string
  points: number
}

function addUtcDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function buildMonthlyBonusSchedule(
  startDate: string,
  cycles: number,
  amount: number,
): ScheduleItem[] {
  const items: ScheduleItem[] = []
  for (let cycle = 1; cycle <= cycles; cycle++) {
    const dueDate = addUtcDays(startDate, (cycle - 1) * 30)
    const d = new Date(`${dueDate}T00:00:00.000Z`)
    items.push({
      cycle,
      dueDate,
      label: d.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
      points: amount,
    })
  }
  return items
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: MonthlyBonusSettings
  eligibleUserCount: number
}

/**
 * Outer shell keeps Dialog mounted; form remounts via `key` when opened/settings
 * change so draft state resets without setState-in-effect.
 */
export function MonthlyBonusSettingsDialog({
  open,
  onOpenChange,
  initial,
  eligibleUserCount,
}: Props) {
  const formKey = [
    initial.enabled ? "1" : "0",
    String(initial.amount),
    String(initial.cycles),
    initial.startDate ?? "",
  ].join(":")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <MonthlyBonusSettingsForm
          key={formKey}
          initial={initial}
          eligibleUserCount={eligibleUserCount}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Dialog>
  )
}

function MonthlyBonusSettingsForm({
  initial,
  eligibleUserCount,
  onOpenChange,
}: {
  initial: MonthlyBonusSettings
  eligibleUserCount: number
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initial.enabled)
  const [amount, setAmount] = useState(initial.amount || 100)
  const [cycles, setCycles] = useState<MonthlyBonusCycles>(initial.cycles || 6)
  const [startDate, setStartDate] = useState(
    initial.startDate ?? new Date().toISOString().slice(0, 10),
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const schedule =
    /^\d{4}-\d{2}-\d{2}$/.test(startDate)
      ? buildMonthlyBonusSchedule(startDate, cycles, Math.max(0, amount))
      : []

  async function handleSave() {
    setError(null)
    setLoading(true)
    const fd = new FormData()
    fd.set("enabled", enabled ? "true" : "false")
    fd.set("amount", String(Math.max(0, Math.floor(amount) || 0)))
    fd.set("cycles", String(cycles))
    fd.set("startDate", startDate)
    const result = await saveMonthlyBonusSettingsAction(fd)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    onOpenChange(false)
    router.refresh()
  }

  return (
    <DialogContent className="max-w-xl gap-0 p-0 overflow-hidden">
      <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100">
        <DialogTitle className="text-[17px] font-semibold tracking-tight">
          Monthly Bonus Points Setting
        </DialogTitle>
        <DialogDescription className="text-[13px] text-slate-500">
          Grant bonus points to every registered user every 30 days from the
          distribution start date.
        </DialogDescription>
      </DialogHeader>

      <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
          <div>
            <div className="text-[14px] font-semibold text-slate-800">
              Enable {cycles}-Month Bonus Program
            </div>
            <div className="text-[12.5px] text-slate-500 mt-0.5">
              When on, the daily cron credits each due cycle automatically.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors",
              enabled ? "bg-violet-600" : "bg-slate-300",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                enabled && "translate-x-5",
              )}
            />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-[0.04em]">
              Monthly Bonus Amount (Points)
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                className="w-full px-[11px] py-[9px] pr-24 rounded-lg border border-slate-200 bg-white text-[15px] outline-none focus:border-violet-600 focus:ring-[3px] focus:ring-violet-600/10"
                value={amount}
                onChange={(e) =>
                  setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                }
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                Points/month
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-[0.04em]">
              Bonus Duration
            </label>
            <select
              className="w-full px-[11px] py-[9px] rounded-lg border border-slate-200 bg-white text-[15px] outline-none focus:border-violet-600 focus:ring-[3px] focus:ring-violet-600/10"
              value={cycles}
              onChange={(e) =>
                setCycles(Number(e.target.value) as MonthlyBonusCycles)
              }
            >
              {MONTHLY_BONUS_CYCLE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} Month{n === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 max-w-xs">
          <label className="text-[12px] font-semibold text-slate-400 uppercase tracking-[0.04em]">
            Distribution Start Date
          </label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="date"
              className="w-full pl-9 pr-[11px] py-[9px] rounded-lg border border-slate-200 bg-white text-[15px] outline-none focus:border-violet-600 focus:ring-[3px] focus:ring-violet-600/10"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>

        {schedule.length > 0 && (
          <div>
            <div className="text-[13px] font-semibold text-slate-700 mb-2.5">
              Bonus Schedule ({cycles} Month{cycles === 1 ? "" : "s"} Period)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {schedule.map((item) => (
                <div
                  key={item.cycle}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,20,35,0.04)]"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[12px] font-semibold text-slate-500">
                      Month {item.cycle}
                    </span>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  </div>
                  <div className="text-[13px] font-medium text-slate-800">
                    {item.label}
                  </div>
                  <div className="text-[12px] font-semibold text-violet-600 mt-0.5">
                    +{item.points.toLocaleString()} PTS
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-[13px] text-violet-900 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            <strong>Status:</strong>{" "}
            {enabled ? `${cycles}-Month Bonus Active` : "Disabled"}
          </span>
          <span>
            <strong>Rate:</strong> {amount.toLocaleString()} Pts/Month
          </span>
          <span>
            <strong>Total Eligible:</strong>{" "}
            {eligibleUserCount.toLocaleString()} users
          </span>
        </div>

        {error && (
          <p className="text-sm text-red-600 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            {error}
          </p>
        )}
      </div>

      <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={loading}>
          {loading ? "Saving…" : "Save Changes"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

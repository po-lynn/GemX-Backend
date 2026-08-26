"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, CalendarDays, Check, X } from "lucide-react"
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
 * Right-side drawer (same pattern as Top-up). Form remounts via `key` when
 * opened/settings change so draft state resets without setState-in-effect.
 */
export function MonthlyBonusSettingsDialog({
  open,
  onOpenChange,
  initial,
  eligibleUserCount,
}: Props) {
  if (!open) return null

  const formKey = [
    initial.enabled ? "1" : "0",
    String(initial.amount),
    String(initial.cycles),
    initial.startDate ?? "",
  ].join(":")

  return (
    <MonthlyBonusSettingsForm
      key={formKey}
      initial={initial}
      eligibleUserCount={eligibleUserCount}
      onClose={() => onOpenChange(false)}
    />
  )
}

function MonthlyBonusSettingsForm({
  initial,
  eligibleUserCount,
  onClose,
}: {
  initial: MonthlyBonusSettings
  eligibleUserCount: number
  onClose: () => void
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
    onClose()
    router.refresh()
  }

  return (
    <>
      <div className="lv-drawer-backdrop" onClick={onClose} />
      <aside className="lv-drawer" role="dialog" aria-label="Monthly bonus points settings">
        <header className="lv-drawer-head">
          <div
            className="rt-head-icon"
            style={{
              background: "#f5f3ff",
              color: "#6d28d9",
              border: "1.5px solid #ddd6fe",
            }}
          >
            <CalendarClock style={{ width: 20, height: 20 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="lv-drawer-title">Monthly Bonus Points</div>
            <div className="lv-drawer-sub">
              Credit all registered users every 30 days
            </div>
          </div>
          <button className="lv-drawer-close" onClick={onClose} aria-label="Close">
            <X style={{ width: 16, height: 16 }} />
          </button>
        </header>

        <div className="lv-drawer-body">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--lv-panel-2)",
              border: "1px solid var(--lv-border)",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--lv-text)" }}>
                Enable {cycles}-Month Bonus Program
              </div>
              <div style={{ fontSize: 12.5, color: "var(--lv-text-3)", marginTop: 2 }}>
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

          <h3 className="lv-drawer-section-h">Amount &amp; duration</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lv-text-2)" }}>
                Monthly bonus amount (points)
              </span>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) =>
                    setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                  }
                  style={{ ...inputStyle, paddingRight: 108 }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--lv-text-3)",
                    background: "var(--lv-panel-2)",
                    padding: "2px 6px",
                    borderRadius: 4,
                    pointerEvents: "none",
                  }}
                >
                  Points/month
                </span>
              </div>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lv-text-2)" }}>
                Bonus duration
              </span>
              <select
                value={cycles}
                onChange={(e) =>
                  setCycles(Number(e.target.value) as MonthlyBonusCycles)
                }
                style={inputStyle}
              >
                {MONTHLY_BONUS_CYCLE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} Month{n === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lv-text-2)" }}>
                Distribution start date
              </span>
              <div style={{ position: "relative" }}>
                <CalendarDays
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 14,
                    height: 14,
                    color: "var(--lv-text-3)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 34 }}
                />
              </div>
            </label>
          </div>

          {schedule.length > 0 && (
            <div>
              <h3 className="lv-drawer-section-h">
                Bonus schedule ({cycles} month{cycles === 1 ? "" : "s"})
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                {schedule.map((item) => (
                  <div
                    key={item.cycle}
                    style={{
                      borderRadius: 10,
                      border: "1px solid var(--lv-border)",
                      background: "#fff",
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--lv-text-3)" }}>
                        Month {item.cycle}
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          width: 20,
                          height: 20,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          background: "#f0f9ff",
                          color: "#0284c7",
                        }}
                      >
                        <Check style={{ width: 12, height: 12 }} strokeWidth={3} />
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--lv-text)" }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#6d28d9", marginTop: 2 }}>
                      +{item.points.toLocaleString()} PTS
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              borderRadius: 10,
              border: "1px solid #ede9fe",
              background: "#f5f3ff",
              padding: "12px 14px",
              fontSize: 13,
              color: "#4c1d95",
              display: "flex",
              flexWrap: "wrap",
              gap: "6px 16px",
            }}
          >
            <span>
              <strong>Status:</strong>{" "}
              {enabled ? `${cycles}-Month Bonus Active` : "Disabled"}
            </span>
            <span>
              <strong>Rate:</strong> {amount.toLocaleString()} Pts/Month
            </span>
            <span>
              <strong>Total Eligible:</strong> {eligibleUserCount.toLocaleString()} users
            </span>
          </div>

          {error && (
            <p
              style={{
                fontSize: 13,
                color: "#b91c1c",
                borderRadius: 8,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                padding: "8px 12px",
                margin: 0,
              }}
            >
              {error}
            </p>
          )}
        </div>

        <div className="lv-drawer-foot" style={{ justifyContent: "flex-start" }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              opacity: loading ? 0.5 : 1,
              background: "#6d28d9",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <CalendarClock style={{ width: 14, height: 14 }} />
            {loading ? "Saving…" : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "9px 16px",
              borderRadius: 8,
              border: "1px solid var(--lv-border)",
              background: "none",
              color: "var(--lv-text-2)",
              fontWeight: 500,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </aside>
    </>
  )
}

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "9px 12px",
  border: "1px solid var(--lv-border)",
  borderRadius: 8,
  outline: "none",
  width: "100%",
  background: "#fff",
  color: "var(--lv-text)",
}

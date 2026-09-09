"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { StatusPill } from "@/components/admin/list-view/StatusPill"

type JobRow = {
  id: string
  status: string
  isStale: boolean
  attempts: number
  maxAttempts: number
  availableAt: string
  lockedAt: string | null
  lockedBy: string | null
  lastError: string | null
  createdAt: string
  completedAt: string | null
  campaignId: string | null
  campaignName: string | null
}

type JobCounts = {
  pending: number
  processing: number
  completed: number
  failed: number
  stale: number
}

function fmt(d: string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function SurpriseBonusJobsPanel() {
  const [counts, setCounts] = useState<JobCounts | null>(null)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/points/surprise-bonus/jobs")
      if (!res.ok) return
      const data = (await res.json()) as { counts: JobCounts; jobs: JobRow[] }
      setCounts(data.counts)
      setJobs(data.jobs)
    } catch {
      // keep last known state on transient fetch errors
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(load)
  }, [load])

  async function retry() {
    setRetrying(true)
    try {
      const res = await fetch("/api/admin/points/surprise-bonus/jobs/retry", { method: "POST" })
      const data = (await res.json()) as
        | { success: true; batches: number }
        | { error: string }
      if (!res.ok || "error" in data) {
        toast.error("error" in data ? data.error : "Retry failed")
      } else {
        toast.success(
          data.batches > 0
            ? `Processed ${data.batches} batch${data.batches === 1 ? "" : "es"}`
            : "Nothing to process — queue is already clear",
        )
      }
    } catch {
      toast.error("Retry failed unexpectedly")
    } finally {
      setRetrying(false)
      load()
    }
  }

  const staleCount = counts?.stale ?? 0

  return (
    <div className="lv-card" style={{ marginTop: 20, padding: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--lv-text)", margin: 0 }}>
            Surprise Bonus — Background Jobs
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--lv-text-3)", margin: "3px 0 0" }}>
            Queue behind the All Users Top-up campaigns above — no cron runs this; each row only
            moves when an admin submits a Top-up or clicks Retry.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" onClick={load} disabled={loading} style={secondaryButtonStyle}>
            <RefreshCw style={{ width: 13, height: 13 }} />
            Refresh
          </button>
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            style={retryButtonStyle(staleCount > 0)}
          >
            <AlertTriangle style={{ width: 13, height: 13 }} />
            {retrying ? "Retrying…" : "Retry stuck jobs"}
          </button>
        </div>
      </div>

      {counts && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <StatChip label="Pending" value={counts.pending} />
          <StatChip label="Processing" value={counts.processing} />
          <StatChip label="Stale" value={counts.stale} tone={counts.stale > 0 ? "danger" : undefined} />
          <StatChip label="Completed" value={counts.completed} tone="good" />
          <StatChip label="Failed" value={counts.failed} tone={counts.failed > 0 ? "danger" : undefined} />
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr
              style={{
                textAlign: "left",
                color: "var(--lv-text-3)",
                fontSize: 11.5,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              <th style={thStyle}>Campaign</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Attempts</th>
              <th style={thStyle}>Locked</th>
              <th style={thStyle}>Created</th>
              <th style={thStyle}>Completed</th>
              <th style={thStyle}>Last error</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={7}
                  style={{ padding: "18px 8px", textAlign: "center", color: "var(--lv-text-3)" }}
                >
                  No background jobs yet.
                </td>
              </tr>
            )}
            {jobs.map((j) => (
              <tr key={j.id} style={{ borderTop: "1px solid var(--lv-border)" }}>
                <td style={tdStyle}>{j.campaignName ?? j.campaignId ?? "—"}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <StatusPill status={j.status} />
                    {j.isStale && <span style={staleTagStyle}>STALE</span>}
                  </div>
                </td>
                <td style={tdStyle}>
                  {j.attempts} / {j.maxAttempts}
                </td>
                <td style={tdStyle}>{fmt(j.lockedAt)}</td>
                <td style={tdStyle}>{fmt(j.createdAt)}</td>
                <td style={tdStyle}>{fmt(j.completedAt)}</td>
                <td
                  style={{
                    ...tdStyle,
                    maxWidth: 220,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: j.lastError ? "var(--lv-danger)" : undefined,
                  }}
                  title={j.lastError ?? undefined}
                >
                  {j.lastError ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "good" | "danger"
}) {
  const color = tone === "danger" ? "#B91C1C" : tone === "good" ? "#047857" : "var(--lv-text)"
  const bg = tone === "danger" ? "#FEF2F2" : tone === "good" ? "#ECFDF5" : "var(--lv-panel-2)"
  return (
    <div style={{ padding: "8px 14px", borderRadius: 10, background: bg, minWidth: 84 }}>
      <div style={{ fontSize: 11, color: "var(--lv-text-3)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {value.toLocaleString()}
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: "6px 8px" }
const tdStyle: React.CSSProperties = { padding: "8px 8px", color: "var(--lv-text)" }
const staleTagStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.04em",
  color: "#B91C1C",
  background: "#FEF2F2",
  border: "1px solid #FCA5A5",
  borderRadius: 999,
  padding: "2px 6px",
}
const secondaryButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid var(--lv-border)",
  background: "#fff",
  color: "var(--lv-text-2)",
  fontWeight: 600,
  fontSize: 12.5,
  cursor: "pointer",
}

function retryButtonStyle(hasStale: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    borderRadius: 8,
    border: `1.5px solid ${hasStale ? "var(--lv-danger)" : "var(--lv-border)"}`,
    background: hasStale ? "#FEF2F2" : "#fff",
    color: hasStale ? "#B91C1C" : "var(--lv-text-2)",
    fontWeight: 600,
    fontSize: 12.5,
    cursor: "pointer",
  }
}

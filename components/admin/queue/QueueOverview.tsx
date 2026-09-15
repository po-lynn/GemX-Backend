"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, ChevronRight, RefreshCw, Timer } from "lucide-react"
import { toast } from "sonner"
import { QC, HEALTH_LABEL, HEALTH_TONE, type QueueHealth } from "@/components/admin/queue/tokens"
import { Pill, MonoChip, Sparkline, AreaSparkline, qcButtonStyle } from "@/components/admin/queue/primitives"
import { fmtDurationMs, fmtRelativeFrom, initials } from "@/components/admin/queue/format"

type QueueTypeSummary = {
  type: string
  label: string
  counts: { pending: number; processing: number; completed: number; failed: number; cancelled: number; stale: number }
  depth: number
  failed24h: number
  completed24h: number
  p95RunTimeMs: number | null
  throughput: number[]
  lastRunAt: string | null
  oldestPendingAgeMs: number | null
  health: QueueHealth
}

type PlatformSummary = {
  completed24h: number
  completed24hDeltaPct: number | null
  failed24h: number
  processed24h: number
  failureRatePct: number
  p95RunTimeMs: number | null
  throughput: number[]
  oldestPendingAgeMs: number | null
  oldestPendingType: string | null
}

type Thresholds = { pendingAgeAlertMs: number; failureRateSloPct: number; staleAfterMs: number; maxAttempts: number }

type OverviewData = {
  summaries: QueueTypeSummary[]
  platform: PlatformSummary
  checkedAt: string
  thresholds: Thresholds
}

const HEALTH_PRIORITY: Record<QueueHealth, number> = { failing: 0, stale: 1, idle: 2, healthy: 3 }

export function QueueOverview() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch("/api/admin/queue")
      if (!res.ok) {
        setError("Couldn't load the queue overview — try refreshing.")
        return
      }
      const json = (await res.json()) as OverviewData
      setData(json)
      setError(null)
    } catch {
      setError("Couldn't load the queue overview — try refreshing.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => load(false))
  }, [load])

  async function retryStuckQueues() {
    if (!data) return
    const staleTypes = data.summaries.filter((s) => s.counts.stale > 0).map((s) => s.type)
    if (staleTypes.length === 0) {
      toast.info("Nothing to retry — no queue currently has stale jobs")
      return
    }
    setRetrying(true)
    try {
      const results = await Promise.all(
        staleTypes.map((type) =>
          fetch("/api/admin/queue/retry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type }),
          }).then((r) => r.json() as Promise<{ success: true; batches: number } | { error: string }>),
        ),
      )
      const failures = results.filter((r): r is { error: string } => "error" in r)
      const batches = results.reduce((sum, r) => sum + ("batches" in r ? r.batches : 0), 0)
      if (failures.length > 0) {
        toast.error(`Retried ${staleTypes.length - failures.length}/${staleTypes.length} queues — ${failures[0].error}`)
      } else {
        toast.success(`Retried ${staleTypes.length} queue${staleTypes.length === 1 ? "" : "s"} · ${batches} batch${batches === 1 ? "" : "es"} processed`)
      }
    } catch {
      toast.error("Retry failed unexpectedly")
    } finally {
      setRetrying(false)
      load(true)
    }
  }

  if (error) {
    return (
      <div style={{ marginTop: 20, padding: 18, borderRadius: 12, border: "1px solid #FCA5A5", background: "#FEF2F2" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle style={{ width: 15, height: 15, color: "#B91C1C", flexShrink: 0 }} />
          <p style={{ fontSize: 12.5, color: "#B91C1C", margin: 0, fontWeight: 600 }}>{error}</p>
        </div>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div style={{ marginTop: 20 }}>
        <p style={{ fontSize: 13, color: QC.inkMuted }}>Loading queue overview…</p>
      </div>
    )
  }

  const { summaries, platform, checkedAt, thresholds } = data
  const worst = [...summaries].sort((a, b) => HEALTH_PRIORITY[a.health] - HEALTH_PRIORITY[b.health])[0]
  const showAlert = worst && (worst.health === "failing" || worst.health === "stale")

  const oldestPendingLabel = summaries.find((s) => s.type === platform.oldestPendingType)?.label ?? null
  const oldestOverThreshold = (platform.oldestPendingAgeMs ?? 0) > thresholds.pendingAgeAlertMs
  const failureBarWidthPct = Math.min(100, (platform.failureRatePct / Math.max(thresholds.failureRateSloPct, 0.01)) * 60)
  const failureOverSlo = platform.failureRatePct > thresholds.failureRateSloPct

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: "var(--font-sans)", color: QC.ink }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: QC.gold }}>
            Platform health
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em", margin: "7px 0 0", lineHeight: 1.1 }}>
            Queue overview
          </h1>
          <p style={{ fontSize: 13.5, color: QC.inkMuted, margin: "7px 0 0", lineHeight: 1.5, maxWidth: "56ch" }}>
            Background job health across every feature that uses the queue. Depth, failure rate and latency are
            computed over the last 24 hours.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: QC.inkMuted,
              background: QC.panel, border: `1px solid ${QC.borderDefault}`, borderRadius: 9, padding: "9px 12px",
            }}
          >
            <Timer style={{ width: 13, height: 13, color: QC.inkFaint }} />
            Checked {new Date(checkedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <button type="button" onClick={() => load(true)} disabled={refreshing} style={qcButtonStyle("secondary", refreshing)} className="qc-btn-secondary">
            <RefreshCw style={{ width: 14, height: 14 }} className={refreshing ? "animate-spin" : undefined} />
            Refresh
          </button>
          <button type="button" onClick={retryStuckQueues} disabled={retrying} style={qcButtonStyle("primary", retrying)} className="qc-btn-primary">
            <RefreshCw style={{ width: 14, height: 14, color: QC.goldOnDark }} />
            {retrying ? "Retrying…" : "Retry stuck jobs"}
          </button>
        </div>
      </div>

      {showAlert && worst && (
        <div
          style={{
            display: "flex", gap: 14, alignItems: "flex-start", background: QC.bannerBg,
            border: `1px solid ${QC.bannerBorder}`, borderLeft: `3px solid ${QC.bannerRule}`, borderRadius: 12, padding: "15px 17px",
          }}
        >
          <AlertTriangle style={{ width: 19, height: 19, color: "#9A6E0E", flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: QC.bannerTitle }}>
              {worst.health === "failing"
                ? `${worst.failed24h} job${worst.failed24h === 1 ? "" : "s"} failed in ${worst.label} in the last 24 hours`
                : `${worst.counts.stale} job${worst.counts.stale === 1 ? "" : "s"} stale in ${worst.label}`}
            </div>
            <div style={{ fontSize: 12.5, color: QC.bannerBody, marginTop: 4, lineHeight: 1.55 }}>
              {worst.health === "failing"
                ? "Attempts may already be exhausted, so nothing will retry on its own — open the queue to read the error trace, then retry once the underlying cause is fixed."
                : `A worker likely died while holding the lock past the ${Math.round(thresholds.staleAfterMs / 60000)} minute visibility timeout. Retrying releases the lock and re-enqueues the batch for another attempt.`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={retryStuckQueues}
              disabled={retrying}
              style={{ fontSize: 12, fontWeight: 600, color: QC.bannerTitle, background: "#fff", border: "1px solid #E0CB9C", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}
            >
              Retry all
            </button>
            <Link
              href={`/admin/queue/${encodeURIComponent(worst.type)}`}
              className="qc-btn-gold"
              style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: QC.gold, borderRadius: 8, padding: "8px 12px" }}
            >
              Inspect queue
            </Link>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: 14 }}>
        <KpiCard label="Jobs processed · 24h">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span />
            {platform.completed24hDeltaPct != null && (
              <DeltaChip pct={platform.completed24hDeltaPct} />
            )}
          </div>
          <div style={kpiValueStyle}>{platform.completed24h.toLocaleString()}</div>
          <AreaSparkline values={platform.throughput} stroke={QC.gold} />
        </KpiCard>

        <KpiCard label="Failure rate" corner={<span style={{ fontSize: 10.5, color: QC.inkFaint }}>SLO {thresholds.failureRateSloPct.toFixed(1)}%</span>}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span style={kpiValueStyle}>{platform.failureRatePct.toFixed(1)}%</span>
            <span style={{ fontSize: 12, color: QC.inkMuted }}>of {platform.processed24h.toLocaleString()}</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: QC.borderHairline, overflow: "hidden" }}>
            <div style={{ width: `${failureBarWidthPct}%`, height: "100%", background: failureOverSlo ? "#A8281F" : "#1C7A4F", borderRadius: 99 }} />
          </div>
        </KpiCard>

        <KpiCard label="p95 run time">
          <div style={kpiValueStyle}>{fmtDurationMs(platform.p95RunTimeMs)}</div>
          <div style={{ fontSize: 11.5, color: QC.inkMuted, lineHeight: 1.5 }}>Completed jobs, last 24h, all queues</div>
        </KpiCard>

        <KpiCard label="Oldest pending job" corner={<span style={{ fontSize: 10.5, color: QC.inkFaint }}>alert &gt; {Math.round(thresholds.pendingAgeAlertMs / 60000)}m</span>}>
          <div style={{ ...kpiValueStyle, color: oldestOverThreshold ? "#A8620A" : QC.ink }}>
            {platform.oldestPendingAgeMs == null ? "0s" : fmtDurationMs(platform.oldestPendingAgeMs)}
          </div>
          <div style={{ fontSize: 11.5, color: QC.inkMuted, lineHeight: 1.5 }}>
            {platform.oldestPendingAgeMs == null || !oldestPendingLabel
              ? "No job has waited past its scheduled time"
              : `${oldestPendingLabel} has a job waiting for a worker`}
          </div>
        </KpiCard>
      </div>

      <div style={{ background: QC.panel, border: `1px solid ${QC.borderDefault}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 2px rgba(23,19,14,.03)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${QC.borderHairline}` }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: "-0.01em" }}>Queues</div>
          <span style={{ fontSize: 11, color: QC.inkFaint, background: QC.canvas, borderRadius: 6, padding: "3px 7px" }}>
            {summaries.length} feature{summaries.length === 1 ? "" : "s"}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, color: QC.inkMuted }}>Sorted by risk</span>
        </div>

        {summaries.length === 0 ? (
          <p style={{ padding: "24px 18px", fontSize: 12.5, color: QC.inkMuted, margin: 0 }}>No job types registered yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 1010 }}>
              <div style={queueGridStyle} role="row">
                <HeaderCell>Queue</HeaderCell>
                <HeaderCell>Health</HeaderCell>
                <HeaderCell align="right">Depth</HeaderCell>
                <HeaderCell align="right">Failed 24h</HeaderCell>
                <HeaderCell align="right">p95</HeaderCell>
                <HeaderCell align="center">Throughput</HeaderCell>
                <HeaderCell align="right">Last run</HeaderCell>
                <div />
              </div>
              {[...summaries]
                .sort((a, b) => HEALTH_PRIORITY[a.health] - HEALTH_PRIORITY[b.health])
                .map((q) => (
                  <Link
                    key={q.type}
                    href={`/admin/queue/${encodeURIComponent(q.type)}`}
                    style={{ ...queueGridStyle, textDecoration: "none", color: "inherit", borderBottom: `1px solid ${QC.borderRow}`, cursor: "pointer" }}
                    className="qc-row"
                  >
                    <div style={{ padding: "14px 0", display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                      <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, background: QC.canvas, border: `1px solid ${QC.borderHairline}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: QC.gold }}>
                        {initials(q.label)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.005em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.label}</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: QC.inkFaint, marginTop: 2 }}>{q.type}</div>
                      </div>
                    </div>
                    <div style={{ padding: "14px 0" }}>
                      <Pill tone={HEALTH_TONE[q.health]}>{HEALTH_LABEL[q.health]}</Pill>
                    </div>
                    <div style={{ padding: "14px 0", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 600 }}>{q.depth}</div>
                    <div style={{ padding: "14px 0", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 600, color: q.failed24h === 0 ? QC.inkFaint : "#A8281F" }}>{q.failed24h}</div>
                    <div style={{ padding: "14px 0", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12.5, color: QC.ink2 }}>{fmtDurationMs(q.p95RunTimeMs)}</div>
                    <div style={{ padding: "14px 0" }}>
                      <Sparkline values={q.throughput} tone={HEALTH_TONE[q.health]} />
                    </div>
                    <div style={{ padding: "14px 0", textAlign: "right", fontSize: 12, color: QC.inkMuted }}>{fmtRelativeFrom(q.lastRunAt)}</div>
                    <div style={{ padding: "14px 0", textAlign: "right", color: QC.inkDisabled, display: "flex", justifyContent: "flex-end" }}>
                      <ChevronRight style={{ width: 15, height: 15 }} />
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
        <div style={{ background: QC.panel, border: `1px solid ${QC.borderDefault}`, borderRadius: 14, padding: "17px 18px", boxShadow: "0 1px 2px rgba(23,19,14,.03)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 14 }}>Alert thresholds</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <ThresholdRow label="Pending age" helper="Flagged on this dashboard once breached" value={`> ${Math.round(thresholds.pendingAgeAlertMs / 60000)}m`} />
            <ThresholdRow label="Failure rate" helper="Rolling 24h window, per queue" value={`> ${thresholds.failureRateSloPct.toFixed(1)}%`} />
            <ThresholdRow label="Visibility timeout" helper="Processing jobs held past this are marked stale" value={`${Math.round(thresholds.staleAfterMs / 60000)}m`} />
            <ThresholdRow label="Max attempts" helper="Then the job is left failed for manual retry" value={String(thresholds.maxAttempts)} last />
          </div>
        </div>
      </div>
    </div>
  )
}

const kpiValueStyle: React.CSSProperties = {
  fontSize: 29, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1,
}

const queueGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(200px,2fr) 108px 96px 92px 84px 120px 132px 34px",
  columnGap: 14,
  alignItems: "center",
  padding: "0 18px",
}

function KpiCard({ label, corner, children }: { label: string; corner?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: QC.panel, border: `1px solid ${QC.borderDefault}`, borderRadius: 13, padding: "17px 18px", display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 1px 2px rgba(23,19,14,.03)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: QC.inkMuted }}>{label}</span>
        {corner}
      </div>
      {children}
    </div>
  )
}

function DeltaChip({ pct }: { pct: number }) {
  const positive = pct >= 0
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: positive ? "#1C7A4F" : "#A8281F", background: positive ? "#E7F3EC" : "#FBE9E7", borderRadius: 5, padding: "2px 6px" }}>
      {positive ? "+" : ""}{pct.toFixed(1)}%
    </span>
  )
}

function HeaderCell({ children, align }: { children: React.ReactNode; align?: "right" | "center" }) {
  return (
    <div style={{ padding: "9px 0", textAlign: align, fontSize: 10, fontWeight: 700, letterSpacing: ".11em", textTransform: "uppercase", color: QC.inkFaint }}>
      {children}
    </div>
  )
}

function ThresholdRow({ label, helper, value, last }: { label: string; helper: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: last ? undefined : `1px solid ${QC.borderRow}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: QC.inkFaint, marginTop: 2 }}>{helper}</div>
      </div>
      <MonoChip style={{ fontWeight: 600, fontSize: 12, background: QC.canvas }}>{value}</MonoChip>
    </div>
  )
}

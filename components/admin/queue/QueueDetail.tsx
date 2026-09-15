"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, ArrowLeft, ChevronRight, Download, ExternalLink, RefreshCw, Search, Trash2 } from "lucide-react"
import { QC, HEALTH_LABEL, HEALTH_TONE, statusLabel, statusTone, type QueueHealth } from "@/components/admin/queue/tokens"
import { Pill, MonoChip, qcButtonStyle } from "@/components/admin/queue/primitives"
import { fmtDate, formatResultLabel, formatResultValue } from "@/components/admin/queue/format"
import { JobDrawer } from "@/components/admin/queue/JobDrawer"

type JobRow = {
  id: string
  status: string
  isStale: boolean
  attempts: number
  maxAttempts: number
  lockedAt: string | null
  lockedBy: string | null
  lastError: string | null
  result: Record<string, unknown> | null
  createdAt: string
  completedAt: string | null
  description: string | null
}

type QueueTypeSummary = {
  health: QueueHealth
  counts: { pending: number; processing: number; completed: number; failed: number; cancelled: number; stale: number }
}

type DetailData = {
  label: string
  counts: QueueTypeSummary["counts"]
  summary: QueueTypeSummary
  jobs: JobRow[]
}

const STATUS_FILTERS = ["All", "pending", "processing", "completed", "failed", "cancelled"] as const
const RANGES = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
] as const

const PAGE_SIZE = 20

export function QueueDetail({ type }: { type: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const openJobId = searchParams.get("job")

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null) params.delete(key)
    else params.set(key, value)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("7d")
  const [filter, setFilter] = useState<string>("All")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      try {
        const res = await fetch(`/api/admin/queue?type=${encodeURIComponent(type)}&range=${range}`)
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        if (!res.ok) {
          setError("Couldn't load this queue — try refreshing.")
          return
        }
        setData((await res.json()) as DetailData)
        setError(null)
      } catch {
        setError("Couldn't load this queue — try refreshing.")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [type, range],
  )

  useEffect(() => {
    queueMicrotask(() => load(false))
  }, [load])

  // Filter/search/range all narrow the visible set, so any change resets pagination and
  // selection at the point of change rather than reactively (avoids a setState-in-effect).
  function resetPagingAndSelection() {
    setPage(1)
    setSelected(new Set())
  }
  function updateFilter(f: string) {
    setFilter(f)
    resetPagingAndSelection()
  }
  function updateSearch(v: string) {
    setSearch(v)
    resetPagingAndSelection()
  }
  function updateRange(r: (typeof RANGES)[number]["value"]) {
    setRange(r)
    resetPagingAndSelection()
  }

  async function retryStuck() {
    setRetrying(true)
    try {
      const res = await fetch("/api/admin/queue/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
      const json = (await res.json()) as { success: true; batches: number } | { error: string }
      if (!res.ok || "error" in json) {
        toast.error("error" in json ? json.error : "Retry failed")
      } else {
        toast.success(json.batches > 0 ? `Processed ${json.batches} batch${json.batches === 1 ? "" : "es"}` : "Nothing to process — queue is already clear")
      }
    } catch {
      toast.error("Retry failed unexpectedly")
    } finally {
      setRetrying(false)
      load(true)
    }
  }

  async function deleteJobRow(id: string) {
    if (!window.confirm("Delete this job record? This only removes it from the queue view and can't be undone.")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/queue/${encodeURIComponent(id)}`, { method: "DELETE" })
      const json = (await res.json()) as { success: true } | { error: string }
      if (!res.ok || "error" in json) {
        toast.error("error" in json ? json.error : "Delete failed")
        return
      }
      toast.success("Job deleted")
      load(true)
    } catch {
      toast.error("Delete failed unexpectedly")
    } finally {
      setDeletingId(null)
    }
  }

  const filteredJobs = useMemo(() => {
    if (!data) return []
    let rows = data.jobs
    if (filter !== "All") rows = rows.filter((j) => j.status === filter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(
        (j) => j.id.toLowerCase().includes(q) || (j.description?.toLowerCase().includes(q) ?? false) || (j.lockedBy?.toLowerCase().includes(q) ?? false),
      )
    }
    return rows
  }, [data, filter, search])

  const pageCount = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE))
  const pagedJobs = filteredJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    setSelected((prev) => (prev.size > 0 ? new Set() : new Set(pagedJobs.map((j) => j.id))))
  }

  async function bulkRetry() {
    setBulkBusy(true)
    const ids = [...selected]
    const results = await Promise.all(
      ids.map((id) => fetch(`/api/admin/queue/${encodeURIComponent(id)}/requeue`, { method: "POST" }).then((r) => r.ok)),
    )
    const ok = results.filter(Boolean).length
    toast[ok === ids.length ? "success" : "error"](`Retried ${ok}/${ids.length} jobs`)
    setSelected(new Set())
    setBulkBusy(false)
    load(true)
  }

  async function bulkCancel() {
    if (!window.confirm(`Cancel ${selected.size} job(s)? They will stop being retried.`)) return
    setBulkBusy(true)
    const ids = [...selected]
    const results = await Promise.all(
      ids.map((id) => fetch(`/api/admin/queue/${encodeURIComponent(id)}/cancel`, { method: "POST" }).then((r) => r.ok)),
    )
    const ok = results.filter(Boolean).length
    toast[ok === ids.length ? "success" : "error"](`Cancelled ${ok}/${ids.length} jobs`)
    setSelected(new Set())
    setBulkBusy(false)
    load(true)
  }

  function exportCsv(rows: Record<string, string | number>[], filename: string) {
    if (rows.length === 0) {
      toast.info("Nothing to export")
      return
    }
    const headers = Object.keys(rows[0])
    const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportSelectedJobs() {
    const rows = pagedJobs
      .filter((j) => selected.has(j.id))
      .map((j) => ({
        id: j.id, status: j.status, attempts: `${j.attempts}/${j.maxAttempts}`,
        locked_by: j.lockedBy ?? "", created_at: j.createdAt, completed_at: j.completedAt ?? "", last_error: j.lastError ?? "",
      }))
    exportCsv(rows, `${type}-jobs-selected.csv`)
  }

  function exportVisible() {
    exportCsv(
      filteredJobs.map((j) => ({
        id: j.id, status: j.status, attempts: `${j.attempts}/${j.maxAttempts}`,
        locked_by: j.lockedBy ?? "", created_at: j.createdAt, completed_at: j.completedAt ?? "", last_error: j.lastError ?? "",
      })),
      `${type}-jobs.csv`,
    )
  }

  if (notFound) {
    return (
      <div style={{ marginTop: 20 }}>
        <p style={{ fontSize: 13, color: QC.inkMuted }}>Unknown queue type. <Link href="/admin/queue" style={{ color: QC.gold }}>Back to overview</Link></p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ marginTop: 20, padding: 18, borderRadius: 12, border: "1px solid #FCA5A5", background: "#FEF2F2" }}>
        <p style={{ fontSize: 12.5, color: "#B91C1C", margin: 0, fontWeight: 600 }}>{error}</p>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div style={{ marginTop: 20 }}>
        <p style={{ fontSize: 13, color: QC.inkMuted }}>Loading queue…</p>
      </div>
    )
  }

  const { label, counts, summary } = data

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: "var(--font-sans)", color: QC.ink }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <Link href="/admin/queue" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: QC.inkMuted }} className="qc-btn-ghost">
            <ArrowLeft style={{ width: 13, height: 13 }} />
            All queues
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.025em", margin: 0, lineHeight: 1.1 }}>{label}</h1>
            <Pill tone={HEALTH_TONE[summary.health]}>{HEALTH_LABEL[summary.health]}</Pill>
            <MonoChip>{type}</MonoChip>
          </div>
          <p style={{ fontSize: 13, color: QC.inkMuted, margin: "8px 0 0", lineHeight: 1.5, maxWidth: "60ch" }}>
            Retries with increasing backoff (attempts × 2 minutes, capped at 30) up to {data.jobs[0]?.maxAttempts ?? 5} attempts,
            then the job is left failed for manual retry.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <button type="button" onClick={() => load(true)} disabled={refreshing} style={qcButtonStyle("secondary", refreshing)} className="qc-btn-secondary">
            <RefreshCw style={{ width: 14, height: 14 }} className={refreshing ? "animate-spin" : undefined} />
            Refresh
          </button>
          <button type="button" onClick={retryStuck} disabled={retrying} style={qcButtonStyle("primary", retrying)} className="qc-btn-primary">
            <RefreshCw style={{ width: 14, height: 14, color: QC.goldOnDark }} />
            {retrying ? "Retrying…" : "Retry stuck jobs"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", border: `1px solid ${QC.borderDefault}`, background: QC.panel, borderRadius: 13, overflow: "hidden", boxShadow: "0 1px 2px rgba(23,19,14,.03)" }}>
        <StatusCell label="Pending" value={counts.pending} tone="grey" />
        <StatusCell label="Processing" value={counts.processing} tone="blue" />
        <StatusCell label="Stale" value={counts.stale} tone="amber" />
        <StatusCell label="Completed" value={counts.completed} tone="green" />
        <StatusCell label="Failed" value={counts.failed} tone="red" />
        <StatusCell label="Cancelled" value={counts.cancelled} tone="grey" last />
      </div>

      <div style={{ background: QC.panel, border: `1px solid ${QC.borderDefault}`, borderRadius: 14, boxShadow: "0 1px 2px rgba(23,19,14,.03)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${QC.borderHairline}`, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: QC.canvas, border: `1px solid ${QC.borderDefault}`, borderRadius: 9, padding: "7px 10px", minWidth: 210 }}>
            <Search style={{ width: 13, height: 13, color: QC.inkFaint }} />
            <input
              value={search}
              onChange={(e) => updateSearch(e.target.value)}
              placeholder="Job name, id, worker…"
              style={{ border: "none", background: "none", outline: "none", fontSize: 12, color: QC.ink, width: "100%" }}
            />
          </div>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => updateFilter(f)}
              className="qc-chip"
              style={{
                fontSize: 11.5, fontWeight: 600, borderRadius: 99, padding: "6px 11px", cursor: "pointer",
                border: `1px solid ${filter === f ? QC.ink : QC.borderDefault}`,
                background: filter === f ? QC.ink : "#fff",
                color: filter === f ? "#fff" : QC.ink2,
              }}
            >
              {f === "All" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <select
            value={range}
            onChange={(e) => updateRange(e.target.value as typeof range)}
            style={{ fontSize: 12, color: QC.ink2, border: `1px solid ${QC.borderDefault}`, borderRadius: 9, padding: "7px 11px", background: "#fff", cursor: "pointer" }}
          >
            {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button type="button" onClick={exportVisible} className="qc-btn-secondary" style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: QC.ink2, border: `1px solid ${QC.borderDefault}`, borderRadius: 9, padding: "7px 11px", cursor: "pointer", background: "#fff" }}>
            <Download style={{ width: 13, height: 13, color: QC.inkFaint }} />
            Export CSV
          </button>
        </div>

        <JobsTable
          jobs={pagedJobs}
          total={filteredJobs.length}
          page={page}
          pageCount={pageCount}
          onPage={setPage}
          selected={selected}
          onToggle={toggleSelected}
          onToggleAll={toggleAllVisible}
          expandedId={expandedId}
          onExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
          onOpen={(id) => setParam("job", id)}
          onDelete={deleteJobRow}
          deletingId={deletingId}
          onClearFilters={() => { setFilter("All"); setSearch(""); resetPagingAndSelection() }}
        />
      </div>

      {selected.size > 0 && (
        <div style={{ position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", zIndex: 60, display: "flex", alignItems: "center", gap: 12, background: QC.ink, color: "#fff", borderRadius: 13, padding: "11px 13px 11px 17px", boxShadow: "0 14px 34px rgba(23,19,14,.34)" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>
            <strong style={{ color: QC.goldOnDark }}>{selected.size}</strong> job{selected.size === 1 ? "" : "s"} selected
          </span>
          <div style={{ width: 1, height: 22, background: "rgba(255,255,255,.16)" }} />
          <BulkBtn onClick={bulkRetry} disabled={bulkBusy}>Retry</BulkBtn>
          <BulkBtn onClick={bulkCancel} disabled={bulkBusy}>Cancel</BulkBtn>
          <BulkBtn onClick={exportSelectedJobs} disabled={bulkBusy}>Export</BulkBtn>
          <button type="button" onClick={() => setSelected(new Set())} style={{ fontSize: 12, color: "rgba(255,255,255,.62)", background: "none", border: "none", padding: "7px 10px", cursor: "pointer" }} className="qc-btn-ghost">
            Clear
          </button>
        </div>
      )}

      {openJobId && (
        <JobDrawer jobId={openJobId} onClose={() => setParam("job", null)} onChanged={() => load(true)} />
      )}
    </div>
  )
}

function StatusCell({ label, value, tone, last }: { label: string; value: number; tone: "green" | "amber" | "red" | "blue" | "grey"; last?: boolean }) {
  const active = value > 0
  const tones = { green: "#1C7A4F", amber: "#A8620A", red: "#A8281F", blue: "#2B5CA8", grey: "#6B6760" }
  const bgs = { green: "#E7F3EC", amber: "#FDF0DF", red: "#FBE9E7", blue: "#E8EEF8", grey: "#F4F3EF" }
  const ink = active ? tones[tone] : QC.ink
  return (
    <div style={{ minWidth: 0, padding: "15px 17px", borderRight: last ? undefined : `1px solid ${QC.borderHairline}`, borderBottom: `1px solid ${QC.borderHairline}`, background: active ? bgs[tone] : QC.panel }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: active ? tones[tone] : QC.inkMuted }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: tones[tone] }} />
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums", marginTop: 8, color: ink }}>{value}</div>
    </div>
  )
}

function BulkBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, borderRadius: 9, padding: "7px 12px", background: "rgba(255,255,255,.1)", color: "#fff", border: "none", cursor: "pointer", opacity: disabled ? 0.6 : 1 }}
    >
      {children}
    </button>
  )
}

function JobsTable(props: {
  jobs: JobRow[]
  total: number
  page: number
  pageCount: number
  onPage: (p: number) => void
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  expandedId: string | null
  onExpand: (id: string) => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  deletingId: string | null
  onClearFilters: () => void
}) {
  const { jobs, total, page, pageCount, onPage, selected, onToggle, onToggleAll, expandedId, onExpand, onOpen, onDelete, deletingId, onClearFilters } = props
  const gridCols = "38px minmax(220px,2.1fr) 118px 82px 140px 128px 128px minmax(150px,1.1fr) 66px"

  if (total === 0) {
    return (
      <div style={{ padding: "70px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: QC.canvas, border: `1px solid ${QC.borderHairline}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AlertTriangle style={{ width: 24, height: 24, color: QC.inkDisabled }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>No jobs match</div>
          <div style={{ fontSize: 13, color: QC.inkMuted, marginTop: 6, maxWidth: "44ch", lineHeight: 1.55 }}>
            No jobs match the current filters. Try clearing them or widening the date range.
          </div>
        </div>
        <button type="button" onClick={onClearFilters} style={qcButtonStyle("secondary")} className="qc-btn-secondary">Clear filters</button>
      </div>
    )
  }

  const allSelected = jobs.length > 0 && jobs.every((j) => selected.has(j.id))

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 1250 }}>
          <div style={{ display: "grid", gridTemplateColumns: gridCols, columnGap: 14, alignItems: "center", padding: "0 18px", background: QC.subtle, borderBottom: `1px solid ${QC.borderHairline}`, fontSize: 10, fontWeight: 700, letterSpacing: ".11em", textTransform: "uppercase", color: QC.inkFaint }}>
            <div style={{ padding: "9px 0" }}>
              <Checkbox checked={allSelected} onClick={onToggleAll} label="Select all visible jobs" />
            </div>
            <div style={{ padding: "9px 0" }}>Job</div>
            <div style={{ padding: "9px 0" }}>Status</div>
            <div style={{ padding: "9px 0", textAlign: "right" }}>Attempts</div>
            <div style={{ padding: "9px 0" }}>Locked by</div>
            <div style={{ padding: "9px 0" }}>Created</div>
            <div style={{ padding: "9px 0" }}>Finished</div>
            <div style={{ padding: "9px 0" }}>Last error</div>
            <div style={{ padding: "9px 0", textAlign: "right" }}>Actions</div>
          </div>

          {jobs.map((j) => {
            const isExpanded = expandedId === j.id
            const isSelected = selected.has(j.id)
            return (
              <div key={j.id}>
                <div
                  className="qc-row"
                  style={{ display: "grid", gridTemplateColumns: gridCols, columnGap: 14, alignItems: "center", padding: "0 18px", borderBottom: `1px solid ${QC.borderRow}`, background: isSelected ? QC.rowSelected : "#fff", cursor: "pointer" }}
                  onClick={() => onOpen(j.id)}
                >
                  <div style={{ padding: "13px 0" }} onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isSelected} onClick={() => onToggle(j.id)} label={`Select ${j.description ?? j.id}`} />
                  </div>
                  <div style={{ padding: "13px 10px 13px 0", minWidth: 0, display: "flex", alignItems: "center", gap: 9 }}>
                    <button
                      type="button"
                      className="qc-caret"
                      onClick={(e) => { e.stopPropagation(); onExpand(j.id) }}
                      style={{ width: 18, height: 18, flexShrink: 0, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", color: QC.inkFaint, background: isExpanded ? QC.borderHairline : "transparent", border: "none", cursor: "pointer" }}
                    >
                      <ChevronRight style={{ width: 12, height: 12, transform: isExpanded ? "rotate(90deg)" : "none" }} />
                    </button>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.005em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {j.description ?? j.id}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: QC.inkFaint, marginTop: 2 }}>{j.id}</div>
                    </div>
                  </div>
                  <div style={{ padding: "13px 0" }}>
                    <Pill tone={statusTone(j.status, j.isStale)}>{statusLabel(j.status, j.isStale)}</Pill>
                  </div>
                  <div style={{ padding: "13px 0", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12.5, fontWeight: 600, color: j.attempts >= j.maxAttempts && j.status === "failed" ? "#A8281F" : QC.ink2 }}>
                    {j.attempts} / {j.maxAttempts}
                  </div>
                  <div style={{ padding: "13px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: QC.inkMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {j.lockedBy ?? "—"}
                  </div>
                  <div style={{ padding: "13px 0", fontSize: 12, color: QC.ink2, fontVariantNumeric: "tabular-nums" }}>{fmtDate(j.createdAt)}</div>
                  <div style={{ padding: "13px 0", fontSize: 12, color: QC.ink2, fontVariantNumeric: "tabular-nums" }}>{fmtDate(j.completedAt)}</div>
                  <div style={{ padding: "13px 10px 13px 0", fontSize: 11.5, color: j.lastError ? "#A8281F" : QC.inkFaint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={j.lastError ?? undefined}>
                    {j.lastError ?? "—"}
                  </div>
                  <div style={{ padding: "13px 0", display: "flex", gap: 5, justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                    <button type="button" title="Open job" onClick={() => onOpen(j.id)} className="qc-icon-btn" style={iconBtnStyle}>
                      <ExternalLink style={{ width: 13, height: 13 }} />
                    </button>
                    {(j.status === "completed" || j.status === "failed" || j.status === "cancelled") && (
                      <button type="button" title="Delete job" disabled={deletingId === j.id} onClick={() => onDelete(j.id)} className="qc-icon-btn-danger" style={iconBtnStyle}>
                        <Trash2 style={{ width: 13, height: 13 }} />
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: "14px 18px 16px 84px", background: QC.subtle, borderBottom: `1px solid ${QC.borderRow}`, display: "flex", gap: 26, flexWrap: "wrap" }}>
                    {j.result ? (
                      Object.entries(j.result).map(([k, v]) => (
                        <div key={k}>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".11em", textTransform: "uppercase", color: QC.inkFaint }}>{formatResultLabel(k)}</div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{formatResultValue(v)}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: 12, color: QC.inkMuted }}>No result recorded for this job.</div>
                    )}
                    <div style={{ flex: 1, minWidth: 120, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
                      <button type="button" onClick={() => onOpen(j.id)} style={{ fontSize: 12, fontWeight: 600, color: QC.gold, background: "none", border: "none", cursor: "pointer" }}>
                        Open full job detail →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", fontSize: 12, color: QC.inkMuted }}>
        <span>Showing <strong style={{ color: QC.ink }}>{jobs.length}</strong> of {total} jobs</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <PageBtn onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}><ChevronRight style={{ width: 13, height: 13, transform: "rotate(180deg)" }} /></PageBtn>
          {Array.from({ length: pageCount }, (_, i) => i + 1).slice(0, 5).map((p) => (
            <PageBtn key={p} onClick={() => onPage(p)} active={p === page}>{p}</PageBtn>
          ))}
          <PageBtn onClick={() => onPage(Math.min(pageCount, page + 1))} disabled={page === pageCount}><ChevronRight style={{ width: 13, height: 13 }} /></PageBtn>
        </div>
      </div>
    </div>
  )
}

function Checkbox({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      style={{
        width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${checked ? QC.ink : QC.borderStrong}`,
        background: checked ? QC.ink : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.4}><path d="M5 13l4.5 4.5L19 7" /></svg>
      )}
    </div>
  )
}

function PageBtn({ onClick, disabled, active, children }: { onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="qc-chip"
      style={{
        minWidth: 28, height: 28, borderRadius: 7, border: `1px solid ${active ? QC.ink : QC.borderDefault}`,
        background: active ? QC.ink : "#fff", color: disabled ? QC.inkDisabled : active ? "#fff" : QC.ink2,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  )
}

const iconBtnStyle: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 7, border: `1px solid ${QC.borderDefault}`, display: "flex", alignItems: "center",
  justifyContent: "center", color: QC.inkMuted, cursor: "pointer", background: "#fff",
}

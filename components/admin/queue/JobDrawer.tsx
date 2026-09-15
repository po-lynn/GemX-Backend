"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import Link from "next/link"
import type { JobDetail } from "@/components/admin/queue/job-types"
import { QC, statusLabel, statusTone } from "@/components/admin/queue/tokens"
import { Pill, MonoChip } from "@/components/admin/queue/primitives"
import { JobActionsBar } from "@/components/admin/queue/JobActionsBar"
import { JobDetailBody } from "@/components/admin/queue/JobDetailBody"
import { useJobActions } from "@/components/admin/queue/useJobActions"

/**
 * Slide-over job detail, opened from the queue detail table without losing
 * the list underneath. Fetches its own data client-side (GET
 * /api/admin/queue/[id]) so it can be reached from any row without a
 * server round-trip through the page itself.
 */
export function JobDrawer({ jobId, onClose, onChanged }: { jobId: string; onClose: () => void; onChanged: () => void }) {
  const [job, setJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/queue/${encodeURIComponent(jobId)}`)
      if (!res.ok) {
        setError(res.status === 404 ? "This job no longer exists." : "Couldn't load this job.")
        return
      }
      setJob((await res.json()) as JobDetail)
    } catch {
      setError("Couldn't load this job.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const { pending, requeue, cancel, markDone, remove } = useJobActions((action) => {
    if (action === "delete" || action === "done") {
      // Both remove the job's row entirely (see setJobDone in lib/queue/queue.ts) — nothing left to reload.
      onChanged()
      onClose()
    } else {
      load()
      onChanged()
    }
  })

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(23,19,14,.28)" }} />
      <div
        className="qc-drawer-panel"
        style={{
          position: "relative", width: 560, maxWidth: "92vw", height: "100%", background: QC.panel,
          borderLeft: `1px solid ${QC.borderDefault}`, boxShadow: "-18px 0 44px rgba(23,19,14,.16)",
          display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)", color: QC.ink,
        }}
      >
        <div style={{ padding: "18px 22px 15px", borderBottom: `1px solid ${QC.borderHairline}`, display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {job && (
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                <Pill tone={statusTone(job.status, job.isStale)}>{statusLabel(job.status, job.isStale)}</Pill>
                <MonoChip style={{ background: QC.canvas }}>{job.id}</MonoChip>
              </div>
            )}
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", margin: "9px 0 0", lineHeight: 1.2 }}>
              {job ? (job.description ?? job.label) : "Job detail"}
            </h2>
            {job && (
              <div style={{ fontSize: 12, color: QC.inkMuted, marginTop: 5 }}>
                {job.label} · attempt {job.attempts} / {job.maxAttempts}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="qc-icon-btn"
            style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, border: `1px solid ${QC.borderDefault}`, display: "flex", alignItems: "center", justifyContent: "center", color: QC.inkMuted, cursor: "pointer", background: "none" }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {job && (
          <JobActionsBar
            job={job}
            pendingAction={pending?.id === job.id ? pending.action : null}
            onRequeue={() => requeue(job.id)}
            onCancel={() => cancel(job.id)}
            onMarkDone={() => markDone(job.id)}
            onDelete={() => remove(job.id)}
          />
        )}

        <div style={{ flex: 1, overflow: "auto", padding: "20px 22px 34px" }}>
          {loading && <p style={{ fontSize: 13, color: QC.inkMuted }}>Loading…</p>}
          {error && (
            <div style={{ fontSize: 13, color: QC.dangerInk }}>
              {error} <Link href="/admin/queue" style={{ color: QC.gold }}>Back to overview</Link>
            </div>
          )}
          {job && !loading && <JobDetailBody job={job} />}
        </div>
      </div>
    </div>
  )
}

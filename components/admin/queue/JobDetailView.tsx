"use client"

import { useRouter } from "next/navigation"
import type { JobDetail } from "@/components/admin/queue/job-types"
import { QC, statusLabel, statusTone } from "@/components/admin/queue/tokens"
import { Pill, MonoChip } from "@/components/admin/queue/primitives"
import { JobActionsBar } from "@/components/admin/queue/JobActionsBar"
import { JobDetailBody } from "@/components/admin/queue/JobDetailBody"
import { useJobActions } from "@/components/admin/queue/useJobActions"

export { type JobDetail } from "@/components/admin/queue/job-types"

export function JobDetailView({ job }: { job: JobDetail }) {
  const router = useRouter()
  const { pending, requeue, cancel, markDone, remove } = useJobActions((action) => {
    // "done" removes the job's row entirely, same as "delete" — see setJobDone in lib/queue/queue.ts.
    if (action === "delete" || action === "done") router.push("/admin/queue")
    else router.refresh()
  })

  return (
    <div
      style={{
        marginTop: 20, background: QC.panel, border: `1px solid ${QC.borderDefault}`, borderRadius: 14,
        boxShadow: "0 1px 2px rgba(23,19,14,.03)", fontFamily: "var(--font-sans)", color: QC.ink,
      }}
    >
      <div style={{ padding: "18px 22px 15px", borderBottom: `1px solid ${QC.borderHairline}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <Pill tone={statusTone(job.status, job.isStale)}>{statusLabel(job.status, job.isStale)}</Pill>
          <MonoChip style={{ background: QC.canvas }}>{job.id}</MonoChip>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", margin: "9px 0 0", lineHeight: 1.2 }}>
          {job.description ?? job.label}
        </h2>
        <div style={{ fontSize: 12, color: QC.inkMuted, marginTop: 5 }}>
          {job.label} · attempt {job.attempts} / {job.maxAttempts}
        </div>
      </div>

      <JobActionsBar
        job={job}
        pendingAction={pending?.id === job.id ? pending.action : null}
        onRequeue={() => requeue(job.id)}
        onCancel={() => cancel(job.id)}
        onMarkDone={() => markDone(job.id)}
        onDelete={() => remove(job.id)}
      />

      <div style={{ padding: "20px 22px 26px" }}>
        <JobDetailBody job={job} />
      </div>
    </div>
  )
}

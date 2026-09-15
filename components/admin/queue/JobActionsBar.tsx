"use client"

import { toast } from "sonner"
import { CheckCircle2, Copy, RotateCcw, Trash2, XCircle } from "lucide-react"
import type { JobDetail } from "@/components/admin/queue/job-types"
import { QC } from "@/components/admin/queue/tokens"
import { qcButtonStyle } from "@/components/admin/queue/primitives"

type Props = {
  job: JobDetail
  pendingAction: "requeue" | "cancel" | "done" | "delete" | null
  onRequeue: () => void
  onCancel: () => void
  onMarkDone: () => void
  onDelete: () => void
}

/** Matches requeueJob's backend guard: a `processing` job whose lock hasn't gone stale yet may still have a live worker on it. */
function isFreshlyProcessing(job: JobDetail) {
  return job.status === "processing" && !job.isStale
}

const isDeletable = (job: JobDetail) => job.status === "completed" || job.status === "failed" || job.status === "cancelled"

export function JobActionsBar({ job, pendingAction, onRequeue, onCancel, onMarkDone, onDelete }: Props) {
  const disabled = pendingAction !== null

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(job.payload, null, 2))
      toast.success("Payload copied")
    } catch {
      toast.error("Couldn't copy — clipboard access was blocked")
    }
  }

  return (
    <div style={{ padding: "12px 22px", borderBottom: `1px solid ${QC.borderHairline}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={onRequeue}
        disabled={disabled || isFreshlyProcessing(job)}
        title={isFreshlyProcessing(job) ? "A worker may still be actively running this job — wait, or check back once it's stale." : undefined}
        style={qcButtonStyle("primary", disabled || isFreshlyProcessing(job))}
        className="qc-btn-primary"
      >
        <RotateCcw style={{ width: 13, height: 13, color: QC.goldOnDark }} />
        {pendingAction === "requeue" ? "Retrying…" : "Retry now"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled || job.status === "completed"}
        style={qcButtonStyle("secondary", disabled || job.status === "completed")}
        className="qc-btn-secondary"
      >
        <XCircle style={{ width: 13, height: 13 }} />
        {pendingAction === "cancel" ? "Cancelling…" : "Cancel job"}
      </button>
      <button type="button" onClick={copyPayload} style={qcButtonStyle("secondary")} className="qc-btn-secondary">
        <Copy style={{ width: 13, height: 13 }} />
        Copy payload
      </button>
      <button
        type="button"
        onClick={onMarkDone}
        disabled={disabled}
        title="Force this job to completed and remove it from the queue, without running its handler"
        style={qcButtonStyle("secondary", disabled)}
        className="qc-btn-secondary"
      >
        <CheckCircle2 style={{ width: 13, height: 13 }} />
        {pendingAction === "done" ? "Marking…" : "Mark done"}
      </button>
      <div style={{ flex: 1 }} />
      {isDeletable(job) && (
        <button type="button" onClick={onDelete} disabled={disabled} style={qcButtonStyle("danger", disabled)} className="qc-btn-danger">
          <Trash2 style={{ width: 13, height: 13 }} />
          {pendingAction === "delete" ? "Deleting…" : "Delete"}
        </button>
      )}
    </div>
  )
}

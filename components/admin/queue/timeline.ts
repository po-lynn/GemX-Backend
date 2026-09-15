import type { JobDetail } from "@/components/admin/queue/job-types"
import { formatResultLabel, formatResultValue } from "@/components/admin/queue/format"
import type { QueueToneKey } from "@/components/admin/queue/tokens"

export type TimelineStep = {
  label: string
  /** ISO timestamp, or null when the moment isn't recorded (e.g. a job still mid-processing). */
  time: string | null
  detail: string
  tone: QueueToneKey
}

/**
 * Turns a job's real, stored fields into a lifecycle timeline — no fabricated
 * stack traces or steps: every entry maps to an actual column on the row.
 */
export function buildJobTimeline(job: JobDetail): TimelineStep[] {
  const steps: TimelineStep[] = [
    {
      label: "Enqueued",
      time: job.createdAt,
      detail:
        job.availableAt !== job.createdAt
          ? `Not eligible to run until ${new Date(job.availableAt).toLocaleString()}`
          : "Queued for the next available worker",
      tone: "grey",
    },
  ]

  if (job.lockedAt) {
    steps.push({
      label: job.lockedBy ? `Locked by ${job.lockedBy}` : "Locked by a worker",
      time: job.lockedAt,
      detail: job.isStale ? "Still holding the lock past the visibility timeout" : "Actively processing",
      tone: "blue",
    })
  }

  const resultDetail = job.result
    ? Object.entries(job.result)
        .map(([k, v]) => `${formatResultLabel(k)}: ${formatResultValue(v)}`)
        .join(" · ")
    : "No result recorded"

  switch (job.status) {
    case "completed":
      steps.push({ label: "Completed", time: job.completedAt, detail: resultDetail, tone: "green" })
      break
    case "failed":
      steps.push({
        label: "Failed — attempts exhausted",
        time: job.completedAt,
        detail: `Attempt ${job.attempts} of ${job.maxAttempts} · no further retries · ${job.lastError ?? "no error recorded"}`,
        tone: "red",
      })
      break
    case "cancelled":
      steps.push({
        label: "Cancelled",
        time: job.completedAt,
        detail: job.lastError ?? "Cancelled by an admin",
        tone: "grey",
      })
      break
    case "pending":
      if (job.lastError) {
        steps.push({ label: "Attempt failed", time: null, detail: job.lastError, tone: "red" })
        steps.push({
          label: "Retry scheduled",
          time: job.availableAt,
          detail: `Attempt ${job.attempts + 1} of ${job.maxAttempts}`,
          tone: "amber",
        })
      } else {
        steps.push({ label: "Waiting for a worker", time: null, detail: "Not yet claimed", tone: "grey" })
      }
      break
    case "processing":
      steps.push({ label: "Processing", time: null, detail: "A worker is currently running this job", tone: "blue" })
      break
  }

  return steps
}

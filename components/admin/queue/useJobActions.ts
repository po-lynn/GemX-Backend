"use client"

import { useState } from "react"
import { toast } from "sonner"

type Action = "requeue" | "cancel" | "done" | "delete"

const SUCCESS_MESSAGE: Record<Action, string> = {
  requeue: "Job requeued",
  cancel: "Job cancelled",
  done: "Job marked done and removed",
  delete: "Job deleted",
}

/** Shared retry/cancel/mark-done/delete plumbing for a single job — used by JobDetailView (standalone page) and JobDrawer (overlay). */
export function useJobActions(onSuccess?: (action: Action, jobId: string) => void) {
  const [pending, setPending] = useState<{ id: string; action: Action } | null>(null)

  async function run(jobId: string, action: "requeue" | "cancel" | "done", confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) return
    setPending({ id: jobId, action })
    try {
      const res = await fetch(`/api/admin/queue/${encodeURIComponent(jobId)}/${action}`, { method: "POST" })
      const data = (await res.json()) as { success: true } | { error: string }
      if (!res.ok || "error" in data) {
        toast.error("error" in data ? data.error : `${action} failed`)
        return
      }
      toast.success(SUCCESS_MESSAGE[action])
      onSuccess?.(action, jobId)
    } catch {
      toast.error(`${action} failed unexpectedly`)
    } finally {
      setPending(null)
    }
  }

  async function remove(jobId: string) {
    if (!window.confirm("Delete this job record? This only removes it from the queue view and can't be undone.")) return
    setPending({ id: jobId, action: "delete" })
    try {
      const res = await fetch(`/api/admin/queue/${encodeURIComponent(jobId)}`, { method: "DELETE" })
      const data = (await res.json()) as { success: true } | { error: string }
      if (!res.ok || "error" in data) {
        toast.error("error" in data ? data.error : "Delete failed")
        return
      }
      toast.success("Job deleted")
      onSuccess?.("delete", jobId)
    } catch {
      toast.error("Delete failed unexpectedly")
    } finally {
      setPending(null)
    }
  }

  return {
    pending,
    requeue: (jobId: string) => run(jobId, "requeue"),
    cancel: (jobId: string) => run(jobId, "cancel", "Cancel this job? It will stop being retried."),
    markDone: (jobId: string) =>
      run(jobId, "done", "Force this job to 'Done' without running its handler? It'll be removed from the queue immediately, same as a delete — this can't be undone."),
    remove,
  }
}

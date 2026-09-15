import { claimJob, completeJob, failOrRetryJob } from "@/lib/queue/queue"
import type { QueueJobHandler } from "@/lib/queue/types"

/**
 * Claims and processes jobs of `type` until the queue is empty or `maxBatches`
 * is reached. A handler error is recorded via failOrRetryJob (backoff, or
 * terminal `failed` once maxAttempts is reached) and then rethrown, aborting
 * the drain — this matches process-surprise-bonus-jobs.ts's original
 * behavior exactly. Callers such as enqueueSurpriseBonusForAllUsers depend
 * on that throw propagating out of an inline drain to report failure to
 * their own caller, so this must not swallow-and-continue.
 */
export async function drainJobs(
  type: string,
  handler: QueueJobHandler,
  opts?: { maxBatches?: number; lockedBy?: string },
): Promise<{ batches: number }> {
  const maxBatches = opts?.maxBatches ?? 10_000
  const lockedBy = opts?.lockedBy ?? `local-${crypto.randomUUID().slice(0, 8)}`
  let batches = 0

  while (batches < maxBatches) {
    const job = await claimJob(type, lockedBy)
    if (!job) break
    batches++

    try {
      await handler(job)
      await completeJob(job.id)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await failOrRetryJob(job, message)
      throw e
    }
  }

  return { batches }
}

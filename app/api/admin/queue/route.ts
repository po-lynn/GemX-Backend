import { connection, NextRequest } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import {
  DEFAULT_MAX_ATTEMPTS,
  FAILURE_RATE_SLO_PCT,
  PENDING_AGE_ALERT_MS,
  STALE_AFTER_MS,
  getPlatformQueueSummary,
  getQueueTypeSummary,
  listJobs,
} from "@/lib/queue/queue"
import { getQueueJobDefinition, listRegisteredJobTypes } from "@/lib/queue/registry"
import "@/lib/queue/registrations"

const RANGE_MS: Record<string, number | null> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: null,
}

/**
 * GET /api/admin/queue
 * GET /api/admin/queue?type=<type>&range=<24h|7d|30d|all>
 * Without `type`: the queue overview — per-type health/depth/failure/p95/throughput
 * summaries (see getQueueTypeSummary) plus a platform-wide KPI rollup.
 * With `type`: that type's status counts plus its jobs (optionally windowed
 * by `range`, default 7d), enriched via that type's optional describeJobs hook.
 */
export async function GET(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.QUEUE_MANAGEMENT)
  if ("error" in gate) return gate.error

  const params = new URL(request.url).searchParams
  const type = params.get("type")
  const types = listRegisteredJobTypes()

  if (!type) {
    const [summaries, platform] = await Promise.all([
      Promise.all(types.map((t) => getQueueTypeSummary(t.type, t.label))),
      getPlatformQueueSummary(types.map((t) => t.type)),
    ])
    return jsonUncached({
      types,
      summaries,
      platform,
      checkedAt: new Date().toISOString(),
      thresholds: {
        pendingAgeAlertMs: PENDING_AGE_ALERT_MS,
        failureRateSloPct: FAILURE_RATE_SLO_PCT,
        staleAfterMs: STALE_AFTER_MS,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
      },
    })
  }

  const definition = getQueueJobDefinition(type)
  if (!definition) return jsonError(`Unknown job type: ${type}`, 404)

  const rangeKey = params.get("range") ?? "7d"
  const rangeMs = rangeKey in RANGE_MS ? RANGE_MS[rangeKey] : RANGE_MS["7d"]
  const since = rangeMs != null ? new Date(Date.now() - rangeMs) : undefined

  const [jobs, summary] = await Promise.all([
    listJobs(type, 100, { since }),
    getQueueTypeSummary(type, definition.label),
  ])
  const descriptions = definition.describeJobs ? await definition.describeJobs(jobs) : new Map<string, string>()

  return jsonUncached({
    types,
    selectedType: type,
    label: definition.label,
    counts: summary.counts,
    summary,
    thresholds: {
      pendingAgeAlertMs: PENDING_AGE_ALERT_MS,
      failureRateSloPct: FAILURE_RATE_SLO_PCT,
      staleAfterMs: STALE_AFTER_MS,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
    },
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      isStale: j.isStale,
      attempts: j.attempts,
      maxAttempts: j.maxAttempts,
      availableAt: j.availableAt.toISOString(),
      lockedAt: j.lockedAt?.toISOString() ?? null,
      lockedBy: j.lockedBy,
      lastError: j.lastError,
      result: j.result,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt?.toISOString() ?? null,
      description: descriptions.get(j.id) ?? null,
    })),
  })
}

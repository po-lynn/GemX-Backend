import { cache } from "react"
import { db } from "@/drizzle/db"
import { reputationThreshold } from "@/drizzle/schema/reputation-schema"

export type ThresholdId =
  | "rating_below_archive"
  | "negative_streak"
  | "tag_concentration"
  | "non_delivery_reports"
  | "positive_burst"
  | "auto_archive"

export type ThresholdRow = {
  id: ThresholdId
  label: string
  logicDescription: string
  enabled: boolean
  sortOrder: number
  dataAvailable: boolean
}

const DEFAULT_THRESHOLDS: ThresholdRow[] = [
  {
    id: "rating_below_archive",
    label: "Rating below archive threshold",
    logicDescription: "Rating < 3.80 with ≥ 30 reviews",
    enabled: true,
    sortOrder: 1,
    dataAvailable: true,
  },
  {
    id: "negative_streak",
    label: "Negative review streak",
    logicDescription: "7 of the last 10 buyer reviews are 1–2★",
    enabled: true,
    sortOrder: 2,
    dataAvailable: true,
  },
  {
    id: "tag_concentration",
    label: "Bad Communication concentration",
    logicDescription: "Tag on > 25% of reviews in 30 days",
    enabled: true,
    sortOrder: 3,
    dataAvailable: true,
  },
  {
    id: "non_delivery_reports",
    label: "Non-delivery reports",
    // No buyer-report/dispute mechanism exists anywhere in this schema — see design spec.
    logicDescription: "≥ 3 buyers report no shipment after escrow funding in 30 days",
    enabled: false,
    sortOrder: 4,
    dataAvailable: false,
  },
  {
    id: "positive_burst",
    label: "Suspicious positive burst",
    logicDescription: "> 20 reviews in 24h at 3× baseline (volume only — device clustering not available)",
    enabled: true,
    sortOrder: 5,
    dataAvailable: true,
  },
  {
    id: "auto_archive",
    label: "Auto-archive on threshold breach",
    // Toggling this on has no automatic runtime effect yet — no scheduler exists (see design spec).
    logicDescription: "Archive without an admin decision when rating < 3.50 for 30 days",
    enabled: false,
    sortOrder: 6,
    dataAvailable: true,
  },
]

/**
 * Idempotent — inserts the 6 default rules if missing. Safe to call on every read.
 *
 * Wrapped in React's `cache()` so the seeding INSERT runs at most once per
 * request instead of once per nested getThresholds() call. Note this does NOT
 * eliminate the write-on-read entirely: a new request still issues one INSERT
 * ... ON CONFLICT DO NOTHING. Removing it for good needs a different mechanism
 * (module-level latch or an explicit admin seed action) and is out of scope for
 * this fix wave. Outside a React request scope (Vitest), `cache()` is a
 * pass-through, so callers see the un-memoized function.
 */
export const ensureThresholdsSeeded = cache(async function ensureThresholdsSeeded(): Promise<void> {
  await db
    .insert(reputationThreshold)
    .values(DEFAULT_THRESHOLDS)
    .onConflictDoNothing({ target: reputationThreshold.id })
})

export async function getThresholds(): Promise<ThresholdRow[]> {
  await ensureThresholdsSeeded()
  const rows = await db
    .select()
    .from(reputationThreshold)
    .orderBy(reputationThreshold.sortOrder)
  return rows as ThresholdRow[]
}

export async function getEnabledThresholdIds(): Promise<Set<ThresholdId>> {
  const rows = await getThresholds()
  return new Set(rows.filter((r) => r.enabled && r.dataAvailable).map((r) => r.id))
}

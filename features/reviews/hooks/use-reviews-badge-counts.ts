"use client"

import { useEffect, useState } from "react"

type BadgeCounts = { openCases: number; archivedSellers: number }

const EMPTY: BadgeCounts = { openCases: 0, archivedSellers: 0 }

/**
 * One-shot fetch on mount — unlike chat's unread count, this doesn't need
 * realtime push or polling, so it stays out of app/admin/layout.tsx's
 * server-render path (see connection-pool-hardening constraint in the plan).
 *
 * Deliberately NOT gated by pathname. AdminSidebar renders on every admin page
 * and the whole point of the badge is that an open reputation case is visible
 * from anywhere in the panel — gating the fetch to /admin/reviews/* would mean
 * the count only appears once you are already looking at the Reviews section.
 * The cost of calling this from everywhere is addressed on the server instead:
 * computeCaseSummaries and ensureThresholdsSeeded are request-memoized with
 * React `cache()` (see features/reviews/db/reputation-cases.ts and
 * reputation-thresholds.ts).
 */
export function useReviewsBadgeCounts(): BadgeCounts {
  const [counts, setCounts] = useState<BadgeCounts>(EMPTY)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/reviews/badge-counts", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : EMPTY))
      .then((data: BadgeCounts) => {
        if (!cancelled) setCounts(data)
      })
      .catch(() => {
        if (!cancelled) setCounts(EMPTY)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return counts
}

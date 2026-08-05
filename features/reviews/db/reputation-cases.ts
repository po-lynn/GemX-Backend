import { and, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { sellerRating } from "@/drizzle/schema/seller-rating-schema"
import { sellerReputationAction, sellerArchive } from "@/drizzle/schema/reputation-schema"
import { product } from "@/drizzle/schema/product-schema"
import { withQueryTimeout } from "@/lib/query-timeout"
import { getEnabledThresholdIds, type ThresholdId } from "./reputation-thresholds"

const QUERY_TIMEOUT_MS = 6000

export type Severity = "critical" | "high" | "medium" | "watch"

export type ReputationSignal = {
  triggerKey: ThresholdId
  label: string
  detail: string
  severity: Severity
}

export type ReputationCaseTab = "all" | "critical" | "buyer_reports" | "closed"

export type ReputationCase = {
  id: string
  sellerUserId: string
  sellerName: string
  sellerImage: string | null
  isPremium: boolean
  avgRating: number
  reviewCount: number
  ratingChange30d: number
  negativeMixPct: number
  signals: ReputationSignal[]
  severity: Severity
  openSince: Date
  recentReviews: Array<{
    id: string
    buyerName: string
    score: number
    comment: string | null
    tags: string[]
    createdAt: Date
  }>
  activeListingsCount: number
  priorWarningsCount: number
}

type CaseSummary = {
  sellerUserId: string
  signals: ReputationSignal[]
  severity: Severity
  openSince: Date
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 3, high: 2, medium: 1, watch: 0 }

const RULE_SEVERITY: Record<string, Severity> = {
  rating_below_archive: "critical",
  negative_streak: "high",
  tag_concentration: "medium",
  positive_burst: "high",
}

type RuleMatch = { sellerUserId: string; detail: string; maxReviewCreatedAt: Date }

async function matchRatingBelowArchive(): Promise<RuleMatch[]> {
  const rows = await withQueryTimeout(
    db
      .select({
        sellerUserId: sellerRating.sellerUserId,
        avgScore: sql<number>`avg(${sellerRating.score})`,
        reviewCount: sql<number>`count(*)::int`,
        maxReviewCreatedAt: sql<Date>`max(${sellerRating.createdAt})`,
      })
      .from(sellerRating)
      .groupBy(sellerRating.sellerUserId)
      .having(sql`avg(${sellerRating.score}) < 3.80 AND count(*) >= 30`),
    QUERY_TIMEOUT_MS,
    "reputation-rule-rating-below-archive"
  )
  return rows.map((r) => ({
    sellerUserId: r.sellerUserId,
    detail: `${Number(r.avgScore).toFixed(2)} avg over ${r.reviewCount} reviews (floor 3.80)`,
    maxReviewCreatedAt: new Date(r.maxReviewCreatedAt),
  }))
}

async function matchNegativeStreak(): Promise<RuleMatch[]> {
  const result = await withQueryTimeout(
    db.execute(sql`
      SELECT seller_user_id,
             count(*) FILTER (WHERE score <= 2)::int AS negative_count,
             max(created_at) AS max_created_at
      FROM (
        SELECT seller_user_id, score, created_at,
               row_number() OVER (PARTITION BY seller_user_id ORDER BY created_at DESC) AS rn
        FROM seller_rating
      ) ranked
      WHERE rn <= 10
      GROUP BY seller_user_id
      HAVING count(*) FILTER (WHERE score <= 2) >= 7
    `),
    QUERY_TIMEOUT_MS,
    "reputation-rule-negative-streak"
  )
  const rows = [...result] as Array<{ seller_user_id: string; negative_count: number; max_created_at: Date }>
  return rows.map((r) => ({
    sellerUserId: r.seller_user_id,
    detail: `${r.negative_count} of the last 10 reviews are 1–2★`,
    maxReviewCreatedAt: new Date(r.max_created_at),
  }))
}

async function matchTagConcentration(): Promise<RuleMatch[]> {
  const result = await withQueryTimeout(
    db.execute(sql`
      SELECT sr.seller_user_id,
             count(*) FILTER (WHERE rt.name = 'Bad Communication')::int AS tagged_count,
             count(*)::int AS total_count,
             max(sr.created_at) FILTER (WHERE rt.name = 'Bad Communication') AS max_created_at
      FROM seller_rating sr
      LEFT JOIN rating_tag_map rtm ON rtm.rating_id = sr.id
      LEFT JOIN rating_tags rt ON rt.id = rtm.tag_id
      WHERE sr.created_at >= now() - interval '30 days'
      GROUP BY sr.seller_user_id
      HAVING count(*) >= 10
         AND count(*) FILTER (WHERE rt.name = 'Bad Communication')::numeric / count(*) > 0.25
    `),
    QUERY_TIMEOUT_MS,
    "reputation-rule-tag-concentration"
  )
  const rows = [...result] as Array<{
    seller_user_id: string
    tagged_count: number
    total_count: number
    max_created_at: Date | null
  }>
  return rows
    .filter((r) => r.max_created_at)
    .map((r) => ({
      sellerUserId: r.seller_user_id,
      detail: `${Math.round((r.tagged_count / r.total_count) * 100)}% of reviews in the last 30 days tagged Bad Communication`,
      maxReviewCreatedAt: new Date(r.max_created_at as Date),
    }))
}

async function matchPositiveBurst(): Promise<RuleMatch[]> {
  const result = await withQueryTimeout(
    db.execute(sql`
      SELECT seller_user_id,
             count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS count_24h,
             count(*) FILTER (WHERE created_at >= now() - interval '30 days')::numeric / 30 AS baseline_per_day,
             max(created_at) FILTER (WHERE created_at >= now() - interval '24 hours') AS max_created_at
      FROM seller_rating
      GROUP BY seller_user_id
      HAVING count(*) FILTER (WHERE created_at >= now() - interval '24 hours') > 5
         AND count(*) FILTER (WHERE created_at >= now() - interval '24 hours')
             > 3 * (count(*) FILTER (WHERE created_at >= now() - interval '30 days')::numeric / 30)
    `),
    QUERY_TIMEOUT_MS,
    "reputation-rule-positive-burst"
  )
  const rows = [...result] as Array<{
    seller_user_id: string
    count_24h: number
    baseline_per_day: number
    max_created_at: Date | null
  }>
  return rows
    .filter((r) => r.max_created_at)
    .map((r) => ({
      sellerUserId: r.seller_user_id,
      detail: `${r.count_24h} reviews in the last 24h vs a baseline of ${Number(r.baseline_per_day).toFixed(1)}/day`,
      maxReviewCreatedAt: new Date(r.max_created_at as Date),
    }))
}

const RULE_MATCHERS: Record<string, () => Promise<RuleMatch[]>> = {
  rating_below_archive: matchRatingBelowArchive,
  negative_streak: matchNegativeStreak,
  tag_concentration: matchTagConcentration,
  positive_burst: matchPositiveBurst,
}

const RULE_LABELS: Record<string, string> = {
  rating_below_archive: "Rating below archive threshold",
  negative_streak: "Negative review streak",
  tag_concentration: "Bad Communication concentration",
  positive_burst: "Suspicious positive burst",
}

/** Computes every seller's open signals, applying dismissal suppression and archive exclusion. */
async function computeCaseSummaries(): Promise<CaseSummary[]> {
  const enabledIds = await getEnabledThresholdIds()

  const matchesByRule = new Map<string, RuleMatch[]>()
  let hasAnyMatch = false
  for (const ruleId of Object.keys(RULE_MATCHERS)) {
    if (!enabledIds.has(ruleId as ThresholdId)) continue
    const matches = await RULE_MATCHERS[ruleId]()
    matchesByRule.set(ruleId, matches)
    if (matches.length > 0) hasAnyMatch = true
  }

  // Nothing matched any rule — skip the suppression/archive lookups, there is
  // nothing for them to filter.
  if (!hasAnyMatch) return []

  // Scope to only the sellers that matched at least one rule this call — this
  // table grows with every future dismiss action and has no other bound, so
  // an unscoped scan here would grow unbounded across every admin page render
  // (computeCaseSummaries is called by all three exported functions).
  const candidateSellerIds = [
    ...new Set([...matchesByRule.values()].flat().map((m) => m.sellerUserId)),
  ]

  const dismissalRows = await withQueryTimeout(
    db
      .select({
        sellerUserId: sellerReputationAction.sellerUserId,
        triggerKey: sellerReputationAction.triggerKey,
        createdAt: sellerReputationAction.createdAt,
      })
      .from(sellerReputationAction)
      .where(
        and(
          eq(sellerReputationAction.actionType, "dismissed"),
          inArray(sellerReputationAction.sellerUserId, candidateSellerIds)
        )
      ),
    QUERY_TIMEOUT_MS,
    "reputation-dismissals"
  )
  // Max dismissedAt per (seller, trigger) computed in JS rather than via SQL
  // GROUP BY — keeps this a plain select->from->where query.
  const dismissedAt = new Map<string, Date>()
  for (const row of dismissalRows) {
    if (!row.sellerUserId || !row.triggerKey) continue
    const key = `${row.sellerUserId}:${row.triggerKey}`
    const createdAt = new Date(row.createdAt)
    const existing = dismissedAt.get(key)
    if (!existing || createdAt > existing) dismissedAt.set(key, createdAt)
  }

  const archivedRows = await withQueryTimeout(
    db
      .select({ sellerUserId: sellerArchive.sellerUserId })
      .from(sellerArchive)
      .where(sql`${sellerArchive.restoredAt} IS NULL`),
    QUERY_TIMEOUT_MS,
    "reputation-archived-sellers"
  )
  const archivedSellerIds = new Set(archivedRows.map((r) => r.sellerUserId))

  const bySeller = new Map<string, CaseSummary>()
  for (const [ruleId, matches] of matchesByRule) {
    for (const match of matches) {
      if (archivedSellerIds.has(match.sellerUserId)) continue
      const suppressedAt = dismissedAt.get(`${match.sellerUserId}:${ruleId}`)
      if (suppressedAt && suppressedAt >= match.maxReviewCreatedAt) continue

      const severity = RULE_SEVERITY[ruleId] ?? "watch"
      const signal: ReputationSignal = {
        triggerKey: ruleId as ThresholdId,
        label: RULE_LABELS[ruleId] ?? ruleId,
        detail: match.detail,
        severity,
      }
      const existing = bySeller.get(match.sellerUserId)
      if (!existing) {
        bySeller.set(match.sellerUserId, {
          sellerUserId: match.sellerUserId,
          signals: [signal],
          severity,
          openSince: match.maxReviewCreatedAt,
        })
      } else {
        existing.signals.push(signal)
        if (SEVERITY_RANK[severity] > SEVERITY_RANK[existing.severity]) existing.severity = severity
        if (match.maxReviewCreatedAt < existing.openSince) existing.openSince = match.maxReviewCreatedAt
      }
    }
  }

  return [...bySeller.values()].sort((a, b) => {
    const rankDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    if (rankDiff !== 0) return rankDiff
    return a.openSince.getTime() - b.openSince.getTime()
  })
}

function filterByTab(summaries: CaseSummary[], tab: ReputationCaseTab): CaseSummary[] {
  if (tab === "critical") return summaries.filter((s) => s.severity === "critical")
  // "buyer_reports" ties to the non_delivery_reports rule, which is never computed
  // (see design spec) — always empty until that rule has real data.
  if (tab === "buyer_reports") return []
  if (tab === "closed") return [] // closed cases are read from seller_reputation_action, not here
  return summaries
}

async function hydrateCases(summaries: CaseSummary[]): Promise<ReputationCase[]> {
  if (summaries.length === 0) return []
  const sellerIds = summaries.map((s) => s.sellerUserId)

  const userRows = await withQueryTimeout(
    db
      .select({
        id: user.id,
        name: user.name,
        image: user.image,
        premiumDealerExpiresAt: user.premiumDealerExpiresAt,
      })
      .from(user)
      .where(inArray(user.id, sellerIds)),
    QUERY_TIMEOUT_MS,
    "reputation-page-users"
  )
  const userById = new Map(userRows.map((r) => [r.id, r]))

  const aggResult = await withQueryTimeout(
    db.execute(sql`
      SELECT seller_user_id,
             avg(score) AS avg_all,
             count(*)::int AS review_count,
             avg(score) FILTER (WHERE created_at < now() - interval '30 days') AS avg_before_30d,
             count(*) FILTER (WHERE score <= 2)::int AS negative_count
      FROM seller_rating
      WHERE seller_user_id = ANY(${sellerIds})
      GROUP BY seller_user_id
    `),
    QUERY_TIMEOUT_MS,
    "reputation-page-rating-aggregates"
  )
  const aggRows = [...aggResult] as Array<{
    seller_user_id: string
    avg_all: number
    review_count: number
    avg_before_30d: number | null
    negative_count: number
  }>
  const aggBySeller = new Map(aggRows.map((r) => [r.seller_user_id, r]))

  const reviewsResult = await withQueryTimeout(
    db.execute(sql`
      SELECT ranked.seller_user_id, ranked.id, u.name AS buyer_name, ranked.score,
             ranked.comment, ranked.created_at,
             coalesce(
               array_agg(rt.name) FILTER (WHERE rt.name IS NOT NULL), '{}'
             ) AS tags
      FROM (
        SELECT sr.*, row_number() OVER (PARTITION BY sr.seller_user_id ORDER BY sr.created_at DESC) AS rn
        FROM seller_rating sr
        WHERE sr.seller_user_id = ANY(${sellerIds})
      ) ranked
      JOIN "user" u ON u.id = ranked.rater_user_id
      LEFT JOIN rating_tag_map rtm ON rtm.rating_id = ranked.id
      LEFT JOIN rating_tags rt ON rt.id = rtm.tag_id
      WHERE ranked.rn <= 3
      GROUP BY ranked.seller_user_id, ranked.id, u.name, ranked.score, ranked.comment, ranked.created_at
      ORDER BY ranked.created_at DESC
    `),
    QUERY_TIMEOUT_MS,
    "reputation-page-recent-reviews"
  )
  const reviewRows = [...reviewsResult] as Array<{
    seller_user_id: string
    id: string
    buyer_name: string
    score: number
    comment: string | null
    created_at: Date
    tags: string[]
  }>
  const reviewsBySeller = new Map<string, typeof reviewRows>()
  for (const row of reviewRows) {
    const list = reviewsBySeller.get(row.seller_user_id) ?? []
    list.push(row)
    reviewsBySeller.set(row.seller_user_id, list)
  }

  // Raw per-row select (no SQL GROUP BY) — tallied in JS below. The candidate
  // seller set is page-sized (<= opts.limit sellers), so this stays cheap.
  const listingRows = await withQueryTimeout(
    db
      .select({ sellerUserId: product.sellerId })
      .from(product)
      .where(sql`${product.sellerId} = ANY(${sellerIds}) AND ${product.status} = 'active'`),
    QUERY_TIMEOUT_MS,
    "reputation-page-active-listings"
  )
  const listingsBySeller = new Map<string, number>()
  for (const row of listingRows) {
    listingsBySeller.set(row.sellerUserId, (listingsBySeller.get(row.sellerUserId) ?? 0) + 1)
  }

  const warningRows = await withQueryTimeout(
    db
      .select({ sellerUserId: sellerReputationAction.sellerUserId })
      .from(sellerReputationAction)
      .where(
        sql`${sellerReputationAction.sellerUserId} = ANY(${sellerIds}) AND ${sellerReputationAction.actionType} IN ('warned', 'archived', 'limited_orders')`
      ),
    QUERY_TIMEOUT_MS,
    "reputation-page-prior-warnings"
  )
  const warningsBySeller = new Map<string, number>()
  for (const row of warningRows) {
    if (!row.sellerUserId) continue
    warningsBySeller.set(row.sellerUserId, (warningsBySeller.get(row.sellerUserId) ?? 0) + 1)
  }

  const now = Date.now()

  return summaries.map((summary) => {
    const u = userById.get(summary.sellerUserId)
    const agg = aggBySeller.get(summary.sellerUserId)
    const avgAll = agg ? Number(agg.avg_all) : 0
    const avgBefore30d = agg?.avg_before_30d != null ? Number(agg.avg_before_30d) : avgAll
    const reviewCount = agg?.review_count ?? 0
    const negativeCount = agg?.negative_count ?? 0

    return {
      id: summary.sellerUserId,
      sellerUserId: summary.sellerUserId,
      sellerName: u?.name ?? "Unknown seller",
      sellerImage: u?.image ?? null,
      isPremium: !!u?.premiumDealerExpiresAt && new Date(u.premiumDealerExpiresAt).getTime() > now,
      avgRating: avgAll,
      reviewCount,
      ratingChange30d: avgAll - avgBefore30d,
      negativeMixPct: reviewCount > 0 ? Math.round((negativeCount / reviewCount) * 100) : 0,
      signals: summary.signals,
      severity: summary.severity,
      openSince: summary.openSince,
      recentReviews: (reviewsBySeller.get(summary.sellerUserId) ?? []).map((r) => ({
        id: r.id,
        buyerName: r.buyer_name,
        score: r.score,
        comment: r.comment,
        tags: r.tags,
        createdAt: new Date(r.created_at),
      })),
      activeListingsCount: listingsBySeller.get(summary.sellerUserId) ?? 0,
      priorWarningsCount: warningsBySeller.get(summary.sellerUserId) ?? 0,
    }
  })
}

export async function getOpenReputationCases(opts: {
  tab: ReputationCaseTab
  page: number
  limit: number
}): Promise<{ cases: ReputationCase[]; total: number }> {
  const summaries = await computeCaseSummaries()
  const filtered = filterByTab(summaries, opts.tab)
  const start = (opts.page - 1) * opts.limit
  const pageSlice = filtered.slice(start, start + opts.limit)
  const cases = await hydrateCases(pageSlice)
  return { cases, total: filtered.length }
}

export async function getReputationCaseCounts(): Promise<{
  all: number
  critical: number
  buyerReports: number
  closed: number
}> {
  const summaries = await computeCaseSummaries()
  const closedCountResult = await withQueryTimeout(
    db
      .select({ count: sql<number>`count(distinct ${sellerReputationAction.sellerUserId})::int` })
      .from(sellerReputationAction)
      .where(
        sql`${sellerReputationAction.actionType} IN ('archived', 'dismissed', 'warned') AND ${sellerReputationAction.createdAt} >= now() - interval '90 days'`
      ),
    QUERY_TIMEOUT_MS,
    "reputation-closed-count"
  )
  return {
    all: summaries.length,
    critical: summaries.filter((s) => s.severity === "critical").length,
    buyerReports: 0,
    closed: closedCountResult[0]?.count ?? 0,
  }
}

export async function getReputationBadgeCounts(): Promise<{
  openCases: number
  archivedSellers: number
}> {
  const summaries = await computeCaseSummaries()
  const archivedResult = await withQueryTimeout(
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sellerArchive)
      .where(sql`${sellerArchive.restoredAt} IS NULL`),
    QUERY_TIMEOUT_MS,
    "reputation-badge-archived-count"
  )
  return {
    openCases: summaries.length,
    archivedSellers: archivedResult[0]?.count ?? 0,
  }
}

/**
 * Monthly bonus points program.
 * Global schedule from Distribution Start Date: every 30 days for N cycles,
 * credited to all non-banned, non-archived users.
 */

import { and, eq, inArray, notInArray, sql } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { pointSetting, pointTransaction } from "@/drizzle/schema/points-schema"
import { creditUserPoints, logPointTransaction } from "@/features/points/db/points"
import { notifyMonthlyBonusGranted } from "@/features/points/services/notify-monthly-bonus"

const MONTHLY_BONUS_ENABLED_KEY = "monthly_bonus_enabled"
const MONTHLY_BONUS_AMOUNT_KEY = "monthly_bonus_amount"
const MONTHLY_BONUS_CYCLES_KEY = "monthly_bonus_cycles"
const MONTHLY_BONUS_START_DATE_KEY = "monthly_bonus_start_date"

export const MONTHLY_BONUS_CYCLE_OPTIONS = [1, 3, 6, 12] as const
export type MonthlyBonusCycles = (typeof MONTHLY_BONUS_CYCLE_OPTIONS)[number]

export type MonthlyBonusSettings = {
  enabled: boolean
  amount: number
  cycles: MonthlyBonusCycles
  /** YYYY-MM-DD (UTC calendar date for schedule) */
  startDate: string | null
}

export type MonthlyBonusScheduleItem = {
  cycle: number
  dueDate: string
  label: string
  points: number
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const GRANT_BATCH_SIZE = 100

function isValidYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
}

function parseCycles(raw: number): MonthlyBonusCycles {
  if ((MONTHLY_BONUS_CYCLE_OPTIONS as readonly number[]).includes(raw)) {
    return raw as MonthlyBonusCycles
  }
  return 6
}

/** Parse YYYY-MM-DD as UTC midnight. */
export function parseUtcDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

/** Format Date as YYYY-MM-DD in UTC. */
export function formatUtcYmd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Add N days to a UTC calendar date (YMD in, YMD out). */
export function addUtcDays(ymd: string, days: number): string {
  const d = parseUtcDate(ymd)
  d.setUTCDate(d.getUTCDate() + days)
  return formatUtcYmd(d)
}

/** Whole UTC calendar days from start (inclusive) to end (inclusive of end as distance). */
export function utcDayDiff(startYmd: string, endYmd: string): number {
  const a = parseUtcDate(startYmd).getTime()
  const b = parseUtcDate(endYmd).getTime()
  return Math.floor((b - a) / MS_PER_DAY)
}

export function monthlyBonusReferenceId(startDate: string, cycle: number): string {
  return `mb:${startDate}:c${cycle}`
}

export function buildMonthlyBonusSchedule(
  startDate: string,
  cycles: number,
  amount: number,
): MonthlyBonusScheduleItem[] {
  const items: MonthlyBonusScheduleItem[] = []
  for (let cycle = 1; cycle <= cycles; cycle++) {
    const dueDate = addUtcDays(startDate, (cycle - 1) * 30)
    const d = parseUtcDate(dueDate)
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    })
    items.push({ cycle, dueDate, label, points: amount })
  }
  return items
}

/** Cycles whose due date is on or before `todayYmd` (1-based), capped by program length. */
export function dueMonthlyBonusCycles(
  startDate: string,
  cycles: number,
  todayYmd: string,
): number[] {
  const diff = utcDayDiff(startDate, todayYmd)
  if (diff < 0) return []
  const maxDue = Math.min(cycles, Math.floor(diff / 30) + 1)
  const out: number[] = []
  for (let c = 1; c <= maxDue; c++) out.push(c)
  return out
}

async function upsertInt(key: string, value: number): Promise<void> {
  const safe = Math.max(0, Math.floor(value) || 0)
  await db
    .insert(pointSetting)
    .values({ key, value: safe })
    .onConflictDoUpdate({ target: pointSetting.key, set: { value: safe } })
}

async function upsertText(key: string, valueText: string | null): Promise<void> {
  await db
    .insert(pointSetting)
    .values({ key, value: 0, valueText })
    .onConflictDoUpdate({
      target: pointSetting.key,
      set: { valueText },
    })
}

export async function getMonthlyBonusSettings(): Promise<MonthlyBonusSettings> {
  const rows = await db
    .select({
      key: pointSetting.key,
      value: pointSetting.value,
      valueText: pointSetting.valueText,
    })
    .from(pointSetting)
    .where(
      inArray(pointSetting.key, [
        MONTHLY_BONUS_ENABLED_KEY,
        MONTHLY_BONUS_AMOUNT_KEY,
        MONTHLY_BONUS_CYCLES_KEY,
        MONTHLY_BONUS_START_DATE_KEY,
      ]),
    )
  const map = new Map(rows.map((r) => [r.key, r]))
  const startRaw = map.get(MONTHLY_BONUS_START_DATE_KEY)?.valueText?.trim() || null
  return {
    enabled: (map.get(MONTHLY_BONUS_ENABLED_KEY)?.value ?? 0) !== 0,
    amount: Math.max(0, map.get(MONTHLY_BONUS_AMOUNT_KEY)?.value ?? 0),
    cycles: parseCycles(map.get(MONTHLY_BONUS_CYCLES_KEY)?.value ?? 6),
    startDate: startRaw && isValidYmd(startRaw) ? startRaw : null,
  }
}

export async function saveMonthlyBonusSettings(
  input: MonthlyBonusSettings,
): Promise<void> {
  const amount = Math.max(0, Math.floor(Number(input.amount) || 0))
  const cycles = parseCycles(Math.floor(Number(input.cycles) || 6))
  const startDate =
    input.startDate && isValidYmd(input.startDate) ? input.startDate : null

  await Promise.all([
    upsertInt(MONTHLY_BONUS_ENABLED_KEY, input.enabled ? 1 : 0),
    upsertInt(MONTHLY_BONUS_AMOUNT_KEY, amount),
    upsertInt(MONTHLY_BONUS_CYCLES_KEY, cycles),
    upsertText(MONTHLY_BONUS_START_DATE_KEY, startDate),
  ])
}

export async function countEligibleMonthlyBonusUsers(): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(user)
    .where(and(eq(user.banned, false), eq(user.archived, false)))
  return row?.value ?? 0
}

async function listEligibleUserIdsExcluding(
  alreadyGranted: string[],
): Promise<string[]> {
  const conditions = [eq(user.banned, false), eq(user.archived, false)]
  if (alreadyGranted.length > 0) {
    // notInArray with huge lists is risky; chunk exclusion via subquery instead when large
    if (alreadyGranted.length <= 5000) {
      conditions.push(notInArray(user.id, alreadyGranted))
    }
  }
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(and(...conditions))
  if (alreadyGranted.length > 5000) {
    const exclude = new Set(alreadyGranted)
    return rows.map((r) => r.id).filter((id) => !exclude.has(id))
  }
  return rows.map((r) => r.id)
}

async function usersAlreadyGranted(
  referenceId: string,
): Promise<string[]> {
  const rows = await db
    .select({ userId: pointTransaction.userId })
    .from(pointTransaction)
    .where(
      and(
        eq(pointTransaction.type, "monthly_bonus"),
        eq(pointTransaction.referenceId, referenceId),
        eq(pointTransaction.status, "completed"),
      ),
    )
  return rows.map((r) => r.userId)
}

export type MonthlyBonusGrantResult = {
  skipped: boolean
  reason?: string
  enabled: boolean
  amount: number
  cycles: number
  startDate: string | null
  today: string
  cyclesProcessed: number[]
  usersCredited: number
  alreadyHadGrant: number
  errors: number
}

/**
 * Grant all due monthly-bonus cycles (idempotent per user + cycle).
 * Designed for a daily cron so 30-day boundaries are not missed.
 */
export async function grantDueMonthlyBonusPoints(
  now: Date = new Date(),
): Promise<MonthlyBonusGrantResult> {
  const settings = await getMonthlyBonusSettings()
  const today = formatUtcYmd(now)

  const base: MonthlyBonusGrantResult = {
    skipped: true,
    enabled: settings.enabled,
    amount: settings.amount,
    cycles: settings.cycles,
    startDate: settings.startDate,
    today,
    cyclesProcessed: [],
    usersCredited: 0,
    alreadyHadGrant: 0,
    errors: 0,
  }

  if (!settings.enabled) {
    return { ...base, reason: "disabled" }
  }
  if (settings.amount <= 0) {
    return { ...base, reason: "amount_zero" }
  }
  if (!settings.startDate) {
    return { ...base, reason: "missing_start_date" }
  }

  const dueCycles = dueMonthlyBonusCycles(
    settings.startDate,
    settings.cycles,
    today,
  )
  if (dueCycles.length === 0) {
    return { ...base, reason: "no_cycle_due_yet" }
  }

  let usersCredited = 0
  let alreadyHadGrant = 0
  let errors = 0
  const cyclesProcessed: number[] = []

  for (const cycle of dueCycles) {
    const referenceId = monthlyBonusReferenceId(settings.startDate, cycle)
    const granted = await usersAlreadyGranted(referenceId)
    alreadyHadGrant += granted.length
    const pending = await listEligibleUserIdsExcluding(granted)

    for (let i = 0; i < pending.length; i += GRANT_BATCH_SIZE) {
      const batch = pending.slice(i, i + GRANT_BATCH_SIZE)
      for (const userId of batch) {
        try {
          const credited = await creditUserPoints(userId, settings.amount)
          if (!credited.success) {
            errors++
            continue
          }
          await logPointTransaction({
            userId,
            type: "monthly_bonus",
            direction: "credit",
            amount: settings.amount,
            status: "completed",
            referenceId,
            referenceType: "monthly_bonus",
            description: `Monthly bonus (month ${cycle}/${settings.cycles})`,
          })
          // Best-effort chat + push; never fail the grant on notify errors.
          await notifyMonthlyBonusGranted({
            userId,
            amount: settings.amount,
          })
          usersCredited++
        } catch (e) {
          errors++
          console.error("[monthly-bonus] grant failed", { userId, cycle, e })
        }
      }
    }
    cyclesProcessed.push(cycle)
  }

  return {
    skipped: false,
    enabled: settings.enabled,
    amount: settings.amount,
    cycles: settings.cycles,
    startDate: settings.startDate,
    today,
    cyclesProcessed,
    usersCredited,
    alreadyHadGrant,
    errors,
  }
}

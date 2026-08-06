"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import {
  archiveSeller,
  dismissCase,
  recordSecondaryAction,
} from "@/features/reviews/db/reputation-actions"
import {
  archiveSellerSchema,
  dismissCaseSchema,
  secondaryActionSchema,
  bulkArchiveSchema,
  bulkDismissSchema,
} from "@/features/reviews/schemas/reputation-actions"
import { zodErrorMessage } from "@/lib/form-data"

type ActionResult = { success: true } | { error: string }

/**
 * Every DB mutation below is wrapped with this so a driver-level throw (unique
 * constraint, timeout, lost connection) reaches the caller as `{ error }` and
 * gets surfaced by the client's existing toast.error path, instead of escaping
 * as an unhandled rejection with no user-visible feedback.
 */
function mutationErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

async function requireReviewsSession(): Promise<{ user: { id: string; role: string } } | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  if (session.user.role === "admin") return session
  if (session.user.role === "internal") {
    const { checkInternalAccess } = await import("@/features/rbac/db/permissions")
    if (await checkInternalAccess(session.user.id, FEATURE_KEYS.REVIEWS)) return session
  }
  return null
}

export async function archiveSellerAction(formData: FormData): Promise<ActionResult> {
  const parsed = archiveSellerSchema.safeParse({
    sellerUserId: formData.get("sellerUserId"),
    reason: formData.get("reason"),
  })
  if (!parsed.success) return { error: zodErrorMessage(parsed.error) }

  const session = await requireReviewsSession()
  if (!session) return { error: "Unauthorized" }

  try {
    await archiveSeller({
      sellerUserId: parsed.data.sellerUserId,
      reason: parsed.data.reason,
      adminUserId: session.user.id,
    })
  } catch (err) {
    return { error: mutationErrorMessage(err, "Failed to archive seller") }
  }
  return { success: true }
}

export async function dismissCaseAction(formData: FormData): Promise<ActionResult> {
  const parsed = dismissCaseSchema.safeParse({
    sellerUserId: formData.get("sellerUserId"),
    triggerKey: formData.get("triggerKey"),
    reason: formData.get("reason"),
  })
  if (!parsed.success) return { error: zodErrorMessage(parsed.error) }

  const session = await requireReviewsSession()
  if (!session) return { error: "Unauthorized" }

  try {
    await dismissCase({
      sellerUserId: parsed.data.sellerUserId,
      triggerKey: parsed.data.triggerKey,
      reason: parsed.data.reason,
      adminUserId: session.user.id,
    })
  } catch (err) {
    return { error: mutationErrorMessage(err, "Failed to dismiss case") }
  }
  return { success: true }
}

export async function recordSecondaryActionAction(formData: FormData): Promise<ActionResult> {
  const parsed = secondaryActionSchema.safeParse({
    sellerUserId: formData.get("sellerUserId"),
    actionType: formData.get("actionType"),
    reason: formData.get("reason") || undefined,
  })
  if (!parsed.success) return { error: zodErrorMessage(parsed.error) }

  const session = await requireReviewsSession()
  if (!session) return { error: "Unauthorized" }

  try {
    await recordSecondaryAction({
      sellerUserId: parsed.data.sellerUserId,
      actionType: parsed.data.actionType,
      reason: parsed.data.reason,
      adminUserId: session.user.id,
    })
  } catch (err) {
    return { error: mutationErrorMessage(err, "Failed to record the action") }
  }
  return { success: true }
}

export async function bulkArchiveSellersAction(
  sellerUserIds: string[],
  reason: string
): Promise<ActionResult> {
  const parsed = bulkArchiveSchema.safeParse({ sellerUserIds, reason })
  if (!parsed.success) return { error: zodErrorMessage(parsed.error) }

  const session = await requireReviewsSession()
  if (!session) return { error: "Unauthorized" }

  // Abort on the first failure rather than pressing on: the earlier sellers are
  // already committed (each archiveSeller is its own statement), so reporting
  // exactly which one broke tells the admin where the batch stopped. Silently
  // continuing past a DB error would leave them believing the whole batch ran.
  for (const [index, sellerUserId] of parsed.data.sellerUserIds.entries()) {
    try {
      await archiveSeller({ sellerUserId, reason: parsed.data.reason, adminUserId: session.user.id })
    } catch (err) {
      return {
        error: `Archived ${index} of ${parsed.data.sellerUserIds.length} sellers, then failed on ${sellerUserId}: ${mutationErrorMessage(err, "Failed to archive seller")}`,
      }
    }
  }
  return { success: true }
}

export async function bulkDismissCasesAction(
  cases: Array<{ sellerUserId: string; triggerKey: string }>,
  reason: string
): Promise<ActionResult> {
  const parsed = bulkDismissSchema.safeParse({ cases, reason })
  if (!parsed.success) return { error: zodErrorMessage(parsed.error) }

  const session = await requireReviewsSession()
  if (!session) return { error: "Unauthorized" }

  // One entry per (seller, signal) — the client expands every selected case into
  // all of its signals, because suppression in computeCaseSummaries is keyed per
  // (seller, rule) and dismissing only one rule would let the case reopen
  // immediately under the remaining rule. Aborts on the first failure, same
  // reasoning as bulkArchiveSellersAction.
  for (const [index, c] of parsed.data.cases.entries()) {
    try {
      await dismissCase({
        sellerUserId: c.sellerUserId,
        triggerKey: c.triggerKey,
        reason: parsed.data.reason,
        adminUserId: session.user.id,
      })
    } catch (err) {
      return {
        error: `Dismissed ${index} of ${parsed.data.cases.length} flags, then failed on ${c.sellerUserId} (${c.triggerKey}): ${mutationErrorMessage(err, "Failed to dismiss case")}`,
      }
    }
  }
  return { success: true }
}

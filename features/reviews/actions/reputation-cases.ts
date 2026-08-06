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

  await archiveSeller({
    sellerUserId: parsed.data.sellerUserId,
    reason: parsed.data.reason,
    adminUserId: session.user.id,
  })
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

  await dismissCase({
    sellerUserId: parsed.data.sellerUserId,
    triggerKey: parsed.data.triggerKey,
    reason: parsed.data.reason,
    adminUserId: session.user.id,
  })
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

  await recordSecondaryAction({
    sellerUserId: parsed.data.sellerUserId,
    actionType: parsed.data.actionType,
    reason: parsed.data.reason,
    adminUserId: session.user.id,
  })
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

  for (const sellerUserId of parsed.data.sellerUserIds) {
    await archiveSeller({ sellerUserId, reason: parsed.data.reason, adminUserId: session.user.id })
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

  for (const c of parsed.data.cases) {
    await dismissCase({
      sellerUserId: c.sellerUserId,
      triggerKey: c.triggerKey,
      reason: parsed.data.reason,
      adminUserId: session.user.id,
    })
  }
  return { success: true }
}

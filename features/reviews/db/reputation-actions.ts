import { db } from "@/drizzle/db"
import { sellerReputationAction, sellerArchive } from "@/drizzle/schema/reputation-schema"
import type { ThresholdId } from "./reputation-thresholds"

export type ReputationActionType =
  | "archived"
  | "restored"
  | "dismissed"
  | "warned"
  | "limited_orders"
  | "listings_hidden"
  | "documents_requested"
  | "escalated"
  | "threshold_toggled"

export async function writeReputationAction(input: {
  sellerUserId: string | null
  actionType: ReputationActionType
  triggerKey?: ThresholdId | null
  reason?: string | null
  adminUserId: string
}): Promise<void> {
  await db.insert(sellerReputationAction).values({
    sellerUserId: input.sellerUserId,
    actionType: input.actionType,
    triggerKey: input.triggerKey ?? null,
    reason: input.reason ?? null,
    adminUserId: input.adminUserId,
  })
}

/** Archiving hides the seller (record-only in phase 1 — see design spec non-goals). */
export async function archiveSeller(input: {
  sellerUserId: string
  reason: string
  adminUserId: string
}): Promise<void> {
  await db.insert(sellerArchive).values({
    sellerUserId: input.sellerUserId,
    reason: input.reason,
    archivedByAdminId: input.adminUserId,
  })
  await writeReputationAction({
    sellerUserId: input.sellerUserId,
    actionType: "archived",
    reason: input.reason,
    adminUserId: input.adminUserId,
  })
}

/** Dismissal only writes the audit/suppression row — the seller is never archived. */
export async function dismissCase(input: {
  sellerUserId: string
  triggerKey: ThresholdId
  reason: string
  adminUserId: string
}): Promise<void> {
  await writeReputationAction({
    sellerUserId: input.sellerUserId,
    actionType: "dismissed",
    triggerKey: input.triggerKey,
    reason: input.reason,
    adminUserId: input.adminUserId,
  })
}

/**
 * Warn / limit orders / hide listings / request documents / escalate — each records intent
 * only. None has functional enforcement yet (see design spec non-goals).
 */
export async function recordSecondaryAction(input: {
  sellerUserId: string
  actionType: Extract<
    ReputationActionType,
    "warned" | "limited_orders" | "listings_hidden" | "documents_requested" | "escalated"
  >
  reason?: string
  adminUserId: string
}): Promise<void> {
  await writeReputationAction({
    sellerUserId: input.sellerUserId,
    actionType: input.actionType,
    reason: input.reason ?? null,
    adminUserId: input.adminUserId,
  })
}

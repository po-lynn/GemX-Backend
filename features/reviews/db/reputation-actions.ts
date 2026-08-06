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

/**
 * Records the seller as archived (record-only in phase 1 — see design spec
 * non-goals; nothing is hidden from buyers yet).
 *
 * seller_archive has a unique index on seller_user_id, so a plain insert throws
 * on an already-archived seller (double-click, double-submit, or a future
 * restore-then-rearchive flow). Upsert instead: refresh the reason/admin/time
 * and clear restoredAt so the row reflects the latest decision. The
 * seller_reputation_action row below is append-only, so the audit trail still
 * shows every archive event.
 */
export async function archiveSeller(input: {
  sellerUserId: string
  reason: string
  adminUserId: string
}): Promise<void> {
  await db
    .insert(sellerArchive)
    .values({
      sellerUserId: input.sellerUserId,
      reason: input.reason,
      archivedByAdminId: input.adminUserId,
    })
    .onConflictDoUpdate({
      target: sellerArchive.sellerUserId,
      set: {
        reason: input.reason,
        archivedByAdminId: input.adminUserId,
        archivedAt: new Date(),
        restoredAt: null,
      },
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

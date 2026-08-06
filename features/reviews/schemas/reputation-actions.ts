import { z } from "zod"

const THRESHOLD_IDS = [
  "rating_below_archive",
  "negative_streak",
  "tag_concentration",
  "non_delivery_reports",
  "positive_burst",
  "auto_archive",
] as const

export const archiveSellerSchema = z.object({
  sellerUserId: z.string().min(1, "Seller is required"),
  reason: z.string().min(1, "A reason is required"),
})

export const dismissCaseSchema = z.object({
  sellerUserId: z.string().min(1, "Seller is required"),
  triggerKey: z.enum(THRESHOLD_IDS),
  reason: z.string().min(1, "A reason is required"),
})

export const secondaryActionSchema = z.object({
  sellerUserId: z.string().min(1, "Seller is required"),
  actionType: z.enum(["warned", "limited_orders", "listings_hidden", "documents_requested", "escalated"]),
  reason: z.string().optional(),
})

export const bulkArchiveSchema = z.object({
  sellerUserIds: z.array(z.string().min(1)).min(1, "Select at least one seller"),
  reason: z.string().min(1, "A reason is required"),
})

export const bulkDismissSchema = z.object({
  cases: z
    .array(z.object({ sellerUserId: z.string().min(1), triggerKey: z.enum(THRESHOLD_IDS) }))
    .min(1, "Select at least one case"),
  reason: z.string().min(1, "A reason is required"),
})

export type ArchiveSellerInput = z.infer<typeof archiveSellerSchema>
export type DismissCaseInput = z.infer<typeof dismissCaseSchema>
export type SecondaryActionInput = z.infer<typeof secondaryActionSchema>
export type BulkArchiveInput = z.infer<typeof bulkArchiveSchema>
export type BulkDismissInput = z.infer<typeof bulkDismissSchema>

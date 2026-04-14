import { z } from "zod"

/** Mobile POST: submit a new escrow service request */
export const mobileSubmitEscrowSchema = z.object({
  type: z.enum(["buyer", "seller"]),
  /** Reference to an existing product in the catalog */
  productId: z.string().uuid().optional(),
  /** Name of the premium dealer package the user selected (e.g. "Basic Package") */
  packageName: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().max(2000).optional(),
})

export type MobileSubmitEscrow = z.infer<typeof mobileSubmitEscrowSchema>

/** Mobile GET: query params for listing own requests */
export const mobileEscrowListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export type MobileEscrowListQuery = z.infer<typeof mobileEscrowListQuerySchema>

/** Admin: update status and optional internal note */
export const adminUpdateEscrowStatusSchema = z.object({
  status: z.enum(["pending", "contacted", "deal_made", "rejected"]),
  adminNote: z.string().trim().max(5000).optional(),
})

export type AdminUpdateEscrowStatus = z.infer<typeof adminUpdateEscrowStatusSchema>

import { z } from "zod"

export const escrowServiceSettingsSchema = z.object({
  userId: z.string().trim().min(1, "Escrow service admin is required"),
  serviceFee: z.coerce.number().min(0, "Service fee must be >= 0").max(1000000),
  serviceOverview: z.string().trim().max(5000).optional(),
})

export type EscrowServiceSettingsInput = z.infer<typeof escrowServiceSettingsSchema>


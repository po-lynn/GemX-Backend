import { z } from "zod"

export const categoryCreateSchema = z.object({
  type: z.enum(["loose_stone", "jewellery"]),
  name: z.string().min(1, "Name is required").max(100),
  shortCode: z
    .string()
    .min(1, "Short code is required")
    .max(20)
    .transform((v) => v.trim()),
  sortOrder: z.coerce.number().int().min(0).default(0),
})

export const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  id: z.string().uuid(),
})

export const categoryDeleteSchema = z.object({
  id: z.string().uuid(),
})

export type CategoryCreate = z.infer<typeof categoryCreateSchema>
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>

import { z } from "zod"

export const categoryCreateSchema = z.object({
  type: z.enum(["loose_stone", "jewellery"]),
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string().min(1, "Slug is required").max(100).regex(/^[a-z0-9_-]+$/, "Slug must be lowercase letters, numbers, hyphens, underscores"),
  sortOrder: z.coerce.number().int().min(0).default(0),
})

export const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  id: z.string().uuid(),
})

export type CategoryCreate = z.infer<typeof categoryCreateSchema>
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>

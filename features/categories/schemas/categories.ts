import { z } from "zod"

function slugFromString(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export const categoryCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .max(100)
    .optional()
    .transform((v, ctx) => {
      const s = v?.trim()
      if (s) return slugFromString(s)
      return undefined
    }),
  parentId: z.string().uuid().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  speciesIds: z.array(z.string().uuid()).optional(),
})

export const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  categoryId: z.string().uuid(),
})

export const categoryDeleteSchema = z.object({
  categoryId: z.string().uuid(),
})

export type CategoryCreate = z.infer<typeof categoryCreateSchema>
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>

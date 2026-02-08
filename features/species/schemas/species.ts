import { z } from "zod"

function slugFromString(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export const speciesCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .max(100)
    .optional()
    .transform((v) => {
      const s = v?.trim()
      if (s) return slugFromString(s)
      return undefined
    }),
})

export const speciesUpdateSchema = speciesCreateSchema.partial().extend({
  speciesId: z.string().uuid(),
})

export const speciesDeleteSchema = z.object({
  speciesId: z.string().uuid(),
})

export type SpeciesCreate = z.infer<typeof speciesCreateSchema>
export type SpeciesUpdate = z.infer<typeof speciesUpdateSchema>

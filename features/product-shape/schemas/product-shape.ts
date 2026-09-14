import { z } from "zod"

export const productShapeCreateSchema = z.object({
  name: z.string().min(1, "Product Shape is required").max(200),
})

export const productShapeUpdateSchema = productShapeCreateSchema.partial().extend({
  productShapeId: z.string().uuid(),
})

export const productShapeDeleteSchema = z.object({
  productShapeId: z.string().uuid(),
})

export type ProductShapeCreate = z.infer<typeof productShapeCreateSchema>
export type ProductShapeUpdate = z.infer<typeof productShapeUpdateSchema>

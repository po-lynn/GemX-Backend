import { z } from "zod"

const ratingTagTypeSchema = z.enum(["positive", "neutral", "negative"])

export const ratingTagCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  type: ratingTagTypeSchema,
  isActive: z.boolean(),
})

export const ratingTagUpdateSchema = z.object({
  ratingTagId: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(200),
  type: ratingTagTypeSchema,
  isActive: z.boolean(),
})

export const ratingTagDeleteSchema = z.object({
  ratingTagId: z.string().uuid(),
})

export type RatingTagCreate = z.infer<typeof ratingTagCreateSchema>

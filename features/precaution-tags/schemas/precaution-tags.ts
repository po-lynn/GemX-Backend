import { z } from "zod"

const precautionTagSeveritySchema = z.enum(["critical", "warning", "info"])
const precautionTagAppliesToSchema = z.enum(["certified", "non_certified", "both"])

export const precautionTagCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  severity: precautionTagSeveritySchema,
  appliesTo: precautionTagAppliesToSchema,
  isActive: z.boolean(),
})

export const precautionTagUpdateSchema = z.object({
  precautionTagId: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(200),
  severity: precautionTagSeveritySchema,
  appliesTo: precautionTagAppliesToSchema,
  isActive: z.boolean(),
})

export const precautionTagDeleteSchema = z.object({
  precautionTagId: z.string().uuid(),
})

export type PrecautionTagCreate = z.infer<typeof precautionTagCreateSchema>

import { z } from "zod"

/**
 * Shared gemstone specification schema.
 * Used for both:
 * - Loose stone products (spec fields on product table)
 * - Jewellery gemstones (product_jewellery_gemstone rows)
 * Single source of truth for validation, types, and search/filter field names.
 */

export const productShapeSchema = z.enum([
  "Oval",
  "Cushion",
  "Round",
  "Pear",
  "Heart",
])
export const productTreatmentSchema = z.enum([
  "None",
  "Heated",
  "Oiled",
  "Glass Filled",
])

/** Weight (carat) - optional in schema; required in context (e.g. jewellery row) */
const weightCaratSchema = z
  .string()
  .optional()
  .nullable()
  .refine(
    (v) => !v || v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0),
    { message: "Weight must be a valid number" }
  )

/** All gemstone specification fields (same as loose stone / report fields) */
export const gemstoneSpecSchema = z.object({
  weightCarat: weightCaratSchema,
  dimensions: z.string().max(100).optional().nullable(),
  color: z.string().max(100).optional().nullable(),
  shape: productShapeSchema.optional().nullable(),
  treatment: productTreatmentSchema.optional().nullable(),
  origin: z.string().max(200).optional().nullable(),
  /** Cut style: e.g. Mixed cut, brilliant/step (jewellery gemstone / report) */
  cut: z.string().max(100).optional().nullable(),
  /** e.g. Transparent */
  transparency: z.string().max(50).optional().nullable(),
  /** e.g. No indication of thermal treatment, FTIR-tested */
  comment: z.string().max(500).optional().nullable(),
  /** Inclusions: e.g. Rutiles, feathers, solids */
  inclusions: z.string().max(500).optional().nullable(),
  certReportNumber: z.string().max(100).optional().nullable(),
  certReportDate: z.string().max(50).optional().nullable(),
  certLabName: z.string().max(100).optional().nullable(),
})

export type GemstoneSpec = z.infer<typeof gemstoneSpecSchema>

/** Jewellery gemstone = category + required weight + full spec (reuses same fields as loose stone) */
export const jewelleryGemstoneItemSchema = gemstoneSpecSchema.extend({
  categoryId: z.string().uuid(),
  weightCarat: z.string().min(1, "Weight is required"),
})

export type JewelleryGemstoneItem = z.infer<typeof jewelleryGemstoneItemSchema>

/** For form/display: item plus optional category name (from join) */
export type JewelleryGemstoneEntry = JewelleryGemstoneItem & {
  categoryName?: string
}

/** Field names shared for search/filter (both product and product_jewellery_gemstone) */
export const GEMSTONE_SPEC_FIELD_NAMES = [
  "weightCarat",
  "dimensions",
  "color",
  "shape",
  "treatment",
  "origin",
  "cut",
  "transparency",
  "comment",
  "inclusions",
  "certReportNumber",
  "certReportDate",
  "certLabName",
] as const

export type GemstoneSpecFieldName = (typeof GEMSTONE_SPEC_FIELD_NAMES)[number]

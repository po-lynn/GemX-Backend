import { z } from "zod"
import { jewelleryGemstoneItemSchema, productShapeSchema } from "./gemstone-spec"

export { productShapeSchema }

export const productStatusSchema = z.enum(["active", "archive", "sold", "hidden"])
export const productModerationSchema = z.enum([
  "pending",
  "approved",
  "rejected",
])
export const currencySchema = z.enum(["USD", "MMK"])

export const adminProductsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
})

export const productModerationActionSchema = z.object({
  productId: z.string().uuid(),
  moderationStatus: productModerationSchema,
})

export const productStatusActionSchema = z.object({
  productId: z.string().uuid(),
  status: productStatusSchema,
})

export const productFeaturedActionSchema = z.object({
  productId: z.string().uuid(),
  featured: z.number().int().min(0),
})

/** Base object schema without refinements — use for .partial() in update schema */
const productCreateBaseSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  sku: z.string().max(50).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  identification: z
    .string()
    .min(1, "Identification is required")
    .max(500),
  price: z.string().refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
    message: "Price must be a valid number",
  }),
  currency: currencySchema.default("USD"),
  isNegotiable: z.coerce.boolean().default(false),
  productType: z.enum(["loose_stone", "jewellery"]).default("loose_stone"),
  categoryId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null || v === "") return null
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      return uuidRegex.test(v) ? v : null
    }),
  stoneCut: z.enum(["Faceted", "Cabochon"]).optional().nullable(),
  metal: z.enum(["Gold", "Silver", "Other"]).optional().nullable(),
  jewelleryGemstones: z
    .string()
    .optional()
    .transform((s) => {
      if (s === undefined || s === null || String(s).trim() === "") return []
      try {
        const parsed = JSON.parse(s) as unknown
        if (!Array.isArray(parsed)) return []
        return parsed
          .map((x) => jewelleryGemstoneItemSchema.safeParse(x))
          .filter((r): r is z.ZodSafeParseSuccess<z.infer<typeof jewelleryGemstoneItemSchema>> => r.success)
          .map((r) => r.data)
      } catch {
        return []
      }
    }),
  /** Jewellery only: total weight of piece in grams (metal + stones) */
  totalWeightGrams: z
    .string()
    .optional()
    .nullable()
    .refine(
      (v) =>
        !v || v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0),
      { message: "Total weight (g) must be a valid number" }
    ),
  weightCarat: z
    .string()
    .optional()
    .nullable()
    .refine(
      (v) =>
        !v || v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0),
      { message: "Weight must be a valid number" }
    ),
  dimensions: z.string().max(100).optional().nullable(),
  color: z.string().max(100).optional().nullable(),
  shape: productShapeSchema.optional().nullable(),
  origin: z.string().max(200).optional().nullable(),
  laboratoryId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null || v === "") return null
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      return uuidRegex.test(v) ? v : null
    }),
  certReportNumber: z.string().max(100).optional().nullable(),
  certReportDate: z.string().max(50).optional().nullable(),
  certReportUrl: z.string().max(500).optional().nullable(),
  status: productStatusSchema.optional(),
  isFeatured: z.coerce.boolean().optional(),
  imageUrls: z
    .string()
    .optional()
    .transform((s) =>
      s
        ? s
            .split(/[\n,]/)
            .map((u) => u.trim())
            .filter(Boolean)
        : []
    ),
})

export const productCreateSchema = productCreateBaseSchema.superRefine(
  (data, ctx) => {
    if (data.productType === "loose_stone") {
      if (!data.weightCarat?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Weight (carat) is required for loose stone",
          path: ["weightCarat"],
        })
      }
      if (!data.color?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Color is required for loose stone",
          path: ["color"],
        })
      }
      if (!data.origin?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Origin is required for loose stone",
          path: ["origin"],
        })
      }
    }
  }
)

export const productUpdateSchema = productCreateBaseSchema.partial().extend({
  productId: z.string().uuid(),
})

export const productDeleteSchema = z.object({
  productId: z.string().uuid(),
})

export type AdminProductsSearch = z.infer<typeof adminProductsSearchSchema>
export type ProductModerationAction = z.infer<
  typeof productModerationActionSchema
>
export type ProductStatusAction = z.infer<typeof productStatusActionSchema>
export type ProductFeaturedAction = z.infer<typeof productFeaturedActionSchema>
export type ProductCreate = z.infer<typeof productCreateSchema>
export type ProductUpdate = z.infer<typeof productUpdateSchema>

import { z } from "zod"

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

export const productCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  sku: z.string().max(50).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  price: z.string().refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
    message: "Price must be a valid number",
  }),
  currency: currencySchema.default("USD"),
  isNegotiable: z.coerce.boolean().default(false),
  categoryId: z.string().uuid().optional().nullable(),
  speciesId: z.string().uuid().optional().nullable(),
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
  treatment: productTreatmentSchema.optional().nullable(),
  origin: z.string().max(200).optional().nullable(),
  certLabName: z.string().max(100).optional().nullable(),
  certReportNumber: z.string().max(100).optional().nullable(),
  certReportUrl: z.string().max(500).optional().nullable(),
  condition: z.string().max(100).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  status: productStatusSchema.optional(),
  isFeatured: z.coerce.boolean().optional(),
  colorGrade: z.string().max(50).optional().nullable(),
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

export const productUpdateSchema = productCreateSchema.partial().extend({
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

import { z } from "zod";
import { contentCategorySchema } from "@/features/news/schemas/news";

export const articleCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().max(500_000).default("[]"),
  author: z.string().max(200).default(""),
  category: contentCategorySchema.default("general"),
  coverImage: z.url().max(2_000).optional().nullable(),
  isFeatured: z.coerce.boolean().default(false),
  status: z.enum(["draft", "published"]).default("draft"),
  publishDate: z.string().optional().nullable(),
});

export const articleUpdateSchema = z.object({
  articleId: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(500_000).optional(),
  author: z.string().max(200).optional(),
  category: contentCategorySchema.optional(),
  coverImage: z.url().max(2_000).optional().nullable(),
  isFeatured: z.coerce.boolean().optional(),
  status: z.enum(["draft", "published"]).optional(),
  publishDate: z.string().optional().nullable(),
});

export const articleDeleteSchema = z.object({
  articleId: z.string().uuid(),
});

/** Query params for GET /api/articles (mobile list screen). */
export const articleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).catch(20).default(20),
  status: z.enum(["draft", "published"]).catch("published").default("published"),
  search: z.string().max(200).optional(),
  category: contentCategorySchema.optional().catch(undefined),
  featured: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional()
    .catch(undefined),
});

import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const articleCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(200)
    .regex(slugRegex, "Slug must be lowercase letters, numbers, and hyphens only"),
  content: z.string().max(500_000).default("[]"),
  author: z.string().max(200).default(""),
  status: z.enum(["draft", "published"]).default("draft"),
  publishDate: z.string().optional().nullable(),
});

export const articleUpdateSchema = z.object({
  articleId: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  slug: z.string().max(200).regex(slugRegex).optional(),
  content: z.string().max(500_000).optional(),
  author: z.string().max(200).optional(),
  status: z.enum(["draft", "published"]).optional(),
  publishDate: z.string().optional().nullable(),
});

export const articleDeleteSchema = z.object({
  articleId: z.string().uuid(),
});

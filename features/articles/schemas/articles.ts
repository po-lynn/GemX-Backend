import { z } from "zod";

export const articleCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().max(500_000).default("[]"),
  author: z.string().max(200).default(""),
  status: z.enum(["draft", "published"]).default("draft"),
  publishDate: z.string().optional().nullable(),
});

export const articleUpdateSchema = z.object({
  articleId: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(500_000).optional(),
  author: z.string().max(200).optional(),
  status: z.enum(["draft", "published"]).optional(),
  publishDate: z.string().optional().nullable(),
});

export const articleDeleteSchema = z.object({
  articleId: z.string().uuid(),
});

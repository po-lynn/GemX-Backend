import { z } from "zod";

export const newsCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().max(500_000).default("[]"),
  status: z.enum(["draft", "published"]).default("draft"),
  publish: z.string().optional().nullable(),
});

export const newsUpdateSchema = z.object({
  newsId: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(500_000).optional(),
  status: z.enum(["draft", "published"]).optional(),
  publish: z.string().optional().nullable(),
});

export const newsDeleteSchema = z.object({
  newsId: z.string().uuid(),
});

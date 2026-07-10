import { z } from "zod"

export const newsBookmarkBodySchema = z.object({
  newsId: z.string().uuid(),
})

export const articleBookmarkBodySchema = z.object({
  articleId: z.string().uuid(),
})

export const bookmarkListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

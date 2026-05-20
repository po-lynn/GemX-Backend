import { z } from "zod";

const notificationScreenSchema = z.enum([
  "home",
  "article",
  "news",
  "profile",
  "product",
  "custom",
]);

export const adminGlobalPushBodySchema = z
  .object({
    title: z.string().trim().min(1, "title is required").max(200),
    body: z.string().trim().max(1000).optional(),
    screen: notificationScreenSchema.optional().default("home"),
    articleId: z.string().uuid().optional(),
    newsId: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
    link: z.string().trim().max(500).optional(),
    data: z.record(z.string(), z.string()).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.screen === "article" && !val.articleId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "articleId is required when screen is article",
        path: ["articleId"],
      });
    }
    if (val.screen === "news" && !val.newsId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "newsId is required when screen is news",
        path: ["newsId"],
      });
    }
    if (val.screen === "product" && !val.productId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "productId is required when screen is product",
        path: ["productId"],
      });
    }
  });

export type AdminGlobalPushBody = z.infer<typeof adminGlobalPushBodySchema>;

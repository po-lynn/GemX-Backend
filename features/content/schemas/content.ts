import { z } from "zod"
import { NEWS_LANGUAGES } from "@/features/content/services/google-translate"

/** Content categories shown as filter chips in the mobile app. */
export const CONTENT_CATEGORIES = [
  "general",
  "market",
  "gemology",
  "guides",
  "product",
] as const

export const contentCategorySchema = z.enum(CONTENT_CATEGORIES)

/** Editorial kind: News vs Articles (admin Type dropdown). */
export const CONTENT_TYPES = ["news", "article"] as const

export const CONTENT_TYPE_LABELS: Record<(typeof CONTENT_TYPES)[number], string> = {
  news: "News",
  article: "Articles",
}

export const contentTypeSchema = z.enum(CONTENT_TYPES)

/** UI/content language enum (shared by articles and translation helpers). */
export const contentLanguageSchema = z.enum(NEWS_LANGUAGES)

/** Alias kept for articles API query schemas. */
export const newsLanguageSchema = contentLanguageSchema

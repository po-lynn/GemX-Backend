import { NextRequest, connection } from "next/server";
import { jsonCached, jsonError, parseQuery } from "@/lib/api";
import {
  getArticlesPaginatedFromDb,
  getArticleCategoryCountsFromDb,
} from "@/features/articles/db/articles";
import { articleListQuerySchema } from "@/features/articles/schemas/articles";
import { estimateReadTimeMinutes } from "@/lib/read-time";
import {
  pickLocalizedContent,
  pickLocalizedTitle,
} from "@/features/content/services/google-translate";

/**
 * GET /api/news-articles
 * Unified News & Articles list from the `articles` table (same data as /api/articles).
 * Filter editorial kind with `?type=news` or `?type=article`.
 */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const query = parseQuery(searchParams, articleListQuerySchema);

    const [{ items, total }, categoryCounts] = await Promise.all([
      getArticlesPaginatedFromDb({
        page: query.page,
        limit: query.limit,
        status: query.status,
        search: query.search,
        category: query.category,
        type: query.type,
        featured: query.featured,
        sort: "publish",
      }),
      getArticleCategoryCountsFromDb(),
    ]);

    const articles = items.map((item) => {
      const title = query.lang
        ? pickLocalizedTitle(item, query.lang)
        : item.title;
      const content = query.lang
        ? pickLocalizedContent(item, query.lang)
        : item.content;
      return {
        ...item,
        title,
        content,
        readTime: estimateReadTimeMinutes(content),
      };
    });
    return jsonCached({ articles, total, categoryCounts });
  } catch (error) {
    console.error("GET /api/news-articles:", error);
    return jsonError("Failed to fetch news articles", 500);
  }
}

import { NextRequest, connection } from "next/server";
import { jsonCached, jsonError, parseQuery } from "@/lib/api";
import { getNewsPaginatedFromDb } from "@/features/news/db/news";
import { newsListQuerySchema } from "@/features/news/schemas/news";
import { estimateReadTimeMinutes } from "@/lib/read-time";
import { getCachedNewsCategoryCounts } from "@/features/news/db/cache/news";
import { withQueryTimeout, QueryTimeoutError } from "@/lib/query-timeout";

/** Vercel backstop: if a query hangs past this, the platform kills the invocation instead of it running to the plan default. */
export const maxDuration = 10;

const NEWS_QUERY_TIMEOUT_MS = 6000;

function jsonTimeout(message: string): Response {
  return Response.json(
    { error: message },
    { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3" } }
  );
}

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const query = parseQuery(searchParams, newsListQuerySchema);

    // Sequential, not Promise.all: each await releases its pooler connection before the next
    // query opens one, instead of holding two at once (same pattern as getProductById) — keeps
    // peak concurrent connections per request low against Supabase's shared pooler ceiling.
    const { items, total } = await withQueryTimeout(
      getNewsPaginatedFromDb({
        page: query.page,
        limit: query.limit,
        status: query.status,
        search: query.search,
        category: query.category,
        featured: query.featured,
        sort: "publish",
      }),
      NEWS_QUERY_TIMEOUT_MS,
      "news-list"
    );
    // Category chip counts don't change per-request; cached short-TTL to skip the
    // (currently unindexed) GROUP BY on every single /api/news call.
    const categoryCounts = await withQueryTimeout(
      getCachedNewsCategoryCounts(),
      NEWS_QUERY_TIMEOUT_MS,
      "news-category-counts"
    );

    const news = items.map((item) => ({
      ...item,
      readTime: estimateReadTimeMinutes(item.content),
    }));
    return jsonCached({ news, total, categoryCounts });
  } catch (error) {
    if (error instanceof QueryTimeoutError) {
      console.error("GET /api/news: timed out:", error.message);
      return jsonTimeout("News is taking longer than usual to load — please retry");
    }
    console.error("GET /api/news:", error);
    return jsonError("Failed to fetch news", 500);
  }
}

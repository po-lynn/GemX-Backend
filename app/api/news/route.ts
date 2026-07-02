import { NextRequest, connection } from "next/server";
import { jsonCached, jsonError, parseQuery } from "@/lib/api";
import {
  getNewsPaginatedFromDb,
  getNewsCategoryCountsFromDb,
} from "@/features/news/db/news";
import { newsListQuerySchema } from "@/features/news/schemas/news";
import { estimateReadTimeMinutes } from "@/lib/read-time";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const query = parseQuery(searchParams, newsListQuerySchema);

    const [{ items, total }, categoryCounts] = await Promise.all([
      getNewsPaginatedFromDb({
        page: query.page,
        limit: query.limit,
        status: query.status,
        search: query.search,
        category: query.category,
        featured: query.featured,
        sort: "publish",
      }),
      getNewsCategoryCountsFromDb(),
    ]);

    const news = items.map((item) => ({
      ...item,
      readTime: estimateReadTimeMinutes(item.content),
    }));
    return jsonCached({ news, total, categoryCounts });
  } catch (error) {
    console.error("GET /api/news:", error);
    return jsonError("Failed to fetch news", 500);
  }
}

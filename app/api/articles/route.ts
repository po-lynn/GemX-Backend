import { NextRequest, connection } from "next/server";
import { jsonCached, jsonError } from "@/lib/api";
import { getArticlesPaginatedFromDb } from "@/features/articles/db/articles";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const statusParam = searchParams.get("status");
    const status =
      statusParam === "draft" || statusParam === "published" ? statusParam : "published";

    const { items, total } = await getArticlesPaginatedFromDb({ page, limit, status });
    return jsonCached({ articles: items, total });
  } catch (error) {
    console.error("GET /api/articles:", error);
    return jsonError("Failed to fetch articles", 500);
  }
}

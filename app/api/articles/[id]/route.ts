import { NextRequest } from "next/server";
import { jsonCached, jsonError, jsonUncached } from "@/lib/api";
import { getArticleById } from "@/features/articles/db/articles";
import { estimateReadTimeMinutes } from "@/lib/read-time";
import { auth } from "@/lib/auth";
import { isArticleBookmarked } from "@/features/bookmarks/db/article-bookmarks";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const item = await getArticleById(id);
    if (!item) return jsonError("Article not found", 404);
    if (item.status !== "published") return jsonError("Article not found", 404);

    const payload = { ...item, readTime: estimateReadTimeMinutes(item.content) };

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return jsonCached({ ...payload, isBookmarked: false });

    const isBookmarked = await isArticleBookmarked(session.user.id, id);
    return jsonUncached({ ...payload, isBookmarked });
  } catch (error) {
    console.error("GET /api/articles/[id]:", error);
    return jsonError("Failed to fetch article", 500);
  }
}

import { NextRequest } from "next/server";
import { jsonCached, jsonError, jsonUncached } from "@/lib/api";
import { getNewsById } from "@/features/news/db/news";
import { estimateReadTimeMinutes } from "@/lib/read-time";
import { auth } from "@/lib/auth";
import { isNewsBookmarked } from "@/features/bookmarks/db/news-bookmarks";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const item = await getNewsById(id);
    if (!item) return jsonError("News not found", 404);
    if (item.status !== "published") return jsonError("News not found", 404);

    const payload = { ...item, readTime: estimateReadTimeMinutes(item.content) };

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return jsonCached({ ...payload, isBookmarked: false });

    const isBookmarked = await isNewsBookmarked(session.user.id, id);
    return jsonUncached({ ...payload, isBookmarked });
  } catch (error) {
    console.error("GET /api/news/[id]:", error);
    return jsonError("Failed to fetch news", 500);
  }
}

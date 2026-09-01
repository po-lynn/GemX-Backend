import { NextRequest } from "next/server";
import { jsonCached, jsonError, jsonUncached, parseQuery } from "@/lib/api";
import { getArticleById } from "@/features/articles/db/articles";
import { estimateReadTimeMinutes } from "@/lib/read-time";
import { auth } from "@/lib/auth";
import { isArticleBookmarked } from "@/features/bookmarks/db/article-bookmarks";
import { z } from "zod";
import { newsLanguageSchema } from "@/features/news/schemas/news";
import {
  pickLocalizedContent,
  pickLocalizedTitle,
} from "@/features/news/services/google-translate";

type RouteParams = { params: Promise<{ id: string }> };

const articleDetailQuerySchema = z.object({
  lang: newsLanguageSchema.optional().catch(undefined),
});

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const query = parseQuery(searchParams, articleDetailQuerySchema);

    const item = await getArticleById(id);
    if (!item) return jsonError("Article not found", 404);
    if (item.status !== "published") return jsonError("Article not found", 404);

    const title = query.lang ? pickLocalizedTitle(item, query.lang) : item.title;
    const content = query.lang
      ? pickLocalizedContent(item, query.lang)
      : item.content;
    const payload = {
      ...item,
      title,
      content,
      readTime: estimateReadTimeMinutes(content),
    };

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return jsonCached({ ...payload, isBookmarked: false });

    const isBookmarked = await isArticleBookmarked(session.user.id, id);
    return jsonUncached({ ...payload, isBookmarked });
  } catch (error) {
    console.error("GET /api/articles/[id]:", error);
    return jsonError("Failed to fetch article", 500);
  }
}

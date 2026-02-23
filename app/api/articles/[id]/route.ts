import { NextRequest } from "next/server";
import { jsonCached, jsonError } from "@/lib/api";
import { getArticleById } from "@/features/articles/db/articles";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const item = await getArticleById(id);
    if (!item) return jsonError("Article not found", 404);
    if (item.status !== "published") return jsonError("Article not found", 404);
    return jsonCached(item);
  } catch (error) {
    console.error("GET /api/articles/[id]:", error);
    return jsonError("Failed to fetch article", 500);
  }
}

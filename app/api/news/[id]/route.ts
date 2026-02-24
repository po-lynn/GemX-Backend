import { NextRequest } from "next/server";
import { jsonCached, jsonError } from "@/lib/api";
import { getNewsById } from "@/features/news/db/news";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const item = await getNewsById(id);
    if (!item) return jsonError("News not found", 404);
    if (item.status !== "published") return jsonError("News not found", 404);
    return jsonCached(item);
  } catch (error) {
    console.error("GET /api/news/[id]:", error);
    return jsonError("Failed to fetch news", 500);
  }
}

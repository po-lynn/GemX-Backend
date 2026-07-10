import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached, parseQuery } from "@/lib/api"
import { newsBookmarkBodySchema, bookmarkListQuerySchema } from "@/features/bookmarks/schemas/bookmark"
import {
  addNewsBookmark,
  removeNewsBookmark,
  listNewsBookmarks,
  newsExistsById,
} from "@/features/bookmarks/db/news-bookmarks"

/**
 * POST /api/mobile/bookmarks/news
 * Save one news article to the authenticated user's bookmarks.
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = newsBookmarkBodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const { newsId } = parsed.data
    if (!(await newsExistsById(newsId))) return jsonError("News not found", 404)

    await addNewsBookmark(session.user.id, newsId)
    return jsonUncached({ success: true, newsId })
  } catch (e) {
    console.error("POST /api/mobile/bookmarks/news:", e)
    return jsonError("Failed to save bookmark", 500)
  }
}

/**
 * GET /api/mobile/bookmarks/news
 * Paginated list of the authenticated user's bookmarked news.
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const { page, limit } = parseQuery(new URL(request.url).searchParams, bookmarkListQuerySchema)
    const { items, total } = await listNewsBookmarks(session.user.id, page, limit)

    return jsonUncached({ bookmarks: items, page, limit, total })
  } catch (e) {
    console.error("GET /api/mobile/bookmarks/news:", e)
    return jsonError("Failed to load bookmarks", 500)
  }
}

/**
 * DELETE /api/mobile/bookmarks/news
 * Remove one news article from the authenticated user's bookmarks.
 */
export async function DELETE(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = newsBookmarkBodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const { newsId } = parsed.data
    const removed = await removeNewsBookmark(session.user.id, newsId)
    return jsonUncached({ success: true, newsId, removed })
  } catch (e) {
    console.error("DELETE /api/mobile/bookmarks/news:", e)
    return jsonError("Failed to remove bookmark", 500)
  }
}

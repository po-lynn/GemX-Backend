import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached, parseQuery } from "@/lib/api"
import { articleBookmarkBodySchema, bookmarkListQuerySchema } from "@/features/bookmarks/schemas/bookmark"
import {
  addArticleBookmark,
  removeArticleBookmark,
  listArticleBookmarks,
  articleExistsById,
} from "@/features/bookmarks/db/article-bookmarks"

/**
 * POST /api/mobile/bookmarks/article
 * Save one article to the authenticated user's bookmarks.
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = articleBookmarkBodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const { articleId } = parsed.data
    if (!(await articleExistsById(articleId))) return jsonError("Article not found", 404)

    await addArticleBookmark(session.user.id, articleId)
    return jsonUncached({ success: true, articleId })
  } catch (e) {
    console.error("POST /api/mobile/bookmarks/article:", e)
    return jsonError("Failed to save bookmark", 500)
  }
}

/**
 * GET /api/mobile/bookmarks/article
 * Paginated list of the authenticated user's bookmarked articles.
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const { page, limit } = parseQuery(new URL(request.url).searchParams, bookmarkListQuerySchema)
    const { items, total } = await listArticleBookmarks(session.user.id, page, limit)

    return jsonUncached({ bookmarks: items, page, limit, total })
  } catch (e) {
    console.error("GET /api/mobile/bookmarks/article:", e)
    return jsonError("Failed to load bookmarks", 500)
  }
}

/**
 * DELETE /api/mobile/bookmarks/article
 * Remove one article from the authenticated user's bookmarks.
 */
export async function DELETE(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return jsonError("Unauthorized", 401)

    const body = await request.json().catch(() => ({}))
    const parsed = articleBookmarkBodySchema.safeParse(body)
    if (!parsed.success) return jsonError("Invalid input", 400)

    const { articleId } = parsed.data
    const removed = await removeArticleBookmark(session.user.id, articleId)
    return jsonUncached({ success: true, articleId, removed })
  } catch (e) {
    console.error("DELETE /api/mobile/bookmarks/article:", e)
    return jsonError("Failed to remove bookmark", 500)
  }
}

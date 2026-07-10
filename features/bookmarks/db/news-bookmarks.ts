import { db } from "@/drizzle/db"
import { and, desc, eq, sql } from "drizzle-orm"
import { userBookmarkNews } from "@/drizzle/schema/user-bookmark-news-schema"
import { news } from "@/drizzle/schema/news-schema"

export type NewsBookmarkItem = {
  id: string
  newsId: string
  createdAt: Date
  news: {
    id: string
    title: string
    coverImage: string | null
    category: string
    status: string
  }
}

export async function newsExistsById(newsId: string): Promise<boolean> {
  const [row] = await db.select({ id: news.id }).from(news).where(eq(news.id, newsId)).limit(1)
  return Boolean(row)
}

export async function addNewsBookmark(userId: string, newsId: string): Promise<void> {
  await db
    .insert(userBookmarkNews)
    .values({ userId, newsId })
    .onConflictDoNothing({
      target: [userBookmarkNews.userId, userBookmarkNews.newsId],
    })
}

export async function removeNewsBookmark(userId: string, newsId: string): Promise<boolean> {
  const deleted = await db
    .delete(userBookmarkNews)
    .where(and(eq(userBookmarkNews.userId, userId), eq(userBookmarkNews.newsId, newsId)))
    .returning({ id: userBookmarkNews.id })
  return deleted.length > 0
}

export async function isNewsBookmarked(userId: string, newsId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userBookmarkNews.id })
    .from(userBookmarkNews)
    .where(and(eq(userBookmarkNews.userId, userId), eq(userBookmarkNews.newsId, newsId)))
    .limit(1)
  return Boolean(row)
}

export async function listNewsBookmarks(
  userId: string,
  page: number,
  limit: number
): Promise<{ items: NewsBookmarkItem[]; total: number }> {
  const offset = (page - 1) * limit

  const rows = await db
    .select({
      id: userBookmarkNews.id,
      newsId: news.id,
      createdAt: userBookmarkNews.createdAt,
      title: news.title,
      coverImage: news.coverImage,
      category: news.category,
      status: news.status,
    })
    .from(userBookmarkNews)
    .innerJoin(news, eq(news.id, userBookmarkNews.newsId))
    .where(eq(userBookmarkNews.userId, userId))
    .orderBy(desc(userBookmarkNews.createdAt))
    .limit(limit)
    .offset(offset)

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userBookmarkNews)
    .where(eq(userBookmarkNews.userId, userId))

  return {
    items: rows.map((r) => ({
      id: r.id,
      newsId: r.newsId,
      createdAt: r.createdAt,
      news: {
        id: r.newsId,
        title: r.title,
        coverImage: r.coverImage,
        category: r.category,
        status: r.status,
      },
    })),
    total: countRows[0]?.count ?? 0,
  }
}

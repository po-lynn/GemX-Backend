import { db } from "@/drizzle/db"
import { and, desc, eq, sql } from "drizzle-orm"
import { userBookmarkArticle } from "@/drizzle/schema/user-bookmark-article-schema"
import { articles } from "@/drizzle/schema/articles-schema"

export type ArticleBookmarkItem = {
  id: string
  articleId: string
  createdAt: Date
  article: {
    id: string
    title: string
    coverImage: string | null
    category: string
    status: string
  }
}

export async function articleExistsById(articleId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1)
  return Boolean(row)
}

export async function addArticleBookmark(userId: string, articleId: string): Promise<void> {
  await db
    .insert(userBookmarkArticle)
    .values({ userId, articleId })
    .onConflictDoNothing({
      target: [userBookmarkArticle.userId, userBookmarkArticle.articleId],
    })
}

export async function removeArticleBookmark(userId: string, articleId: string): Promise<boolean> {
  const deleted = await db
    .delete(userBookmarkArticle)
    .where(and(eq(userBookmarkArticle.userId, userId), eq(userBookmarkArticle.articleId, articleId)))
    .returning({ id: userBookmarkArticle.id })
  return deleted.length > 0
}

export async function isArticleBookmarked(userId: string, articleId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userBookmarkArticle.id })
    .from(userBookmarkArticle)
    .where(and(eq(userBookmarkArticle.userId, userId), eq(userBookmarkArticle.articleId, articleId)))
    .limit(1)
  return Boolean(row)
}

export async function listArticleBookmarks(
  userId: string,
  page: number,
  limit: number
): Promise<{ items: ArticleBookmarkItem[]; total: number }> {
  const offset = (page - 1) * limit

  const rows = await db
    .select({
      id: userBookmarkArticle.id,
      articleId: articles.id,
      createdAt: userBookmarkArticle.createdAt,
      title: articles.title,
      coverImage: articles.coverImage,
      category: articles.category,
      status: articles.status,
    })
    .from(userBookmarkArticle)
    .innerJoin(articles, eq(articles.id, userBookmarkArticle.articleId))
    .where(eq(userBookmarkArticle.userId, userId))
    .orderBy(desc(userBookmarkArticle.createdAt))
    .limit(limit)
    .offset(offset)

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userBookmarkArticle)
    .where(eq(userBookmarkArticle.userId, userId))

  return {
    items: rows.map((r) => ({
      id: r.id,
      articleId: r.articleId,
      createdAt: r.createdAt,
      article: {
        id: r.articleId,
        title: r.title,
        coverImage: r.coverImage,
        category: r.category,
        status: r.status,
      },
    })),
    total: countRows[0]?.count ?? 0,
  }
}

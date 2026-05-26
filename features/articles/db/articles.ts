import { db } from "@/drizzle/db";
import { articles } from "@/drizzle/schema/articles-schema";
import { eq, ne, desc, sql, type SQL } from "drizzle-orm";

export type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  content: string;
  author: string;
  status: string;
  publishDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getAllArticlesFromDb(): Promise<ArticleRow[]> {
  return db.select().from(articles).orderBy(desc(articles.updatedAt));
}

export async function getArticleById(id: string): Promise<ArticleRow | null> {
  const [row] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  return row ?? null;
}

export async function getArticleBySlug(slug: string): Promise<ArticleRow | null> {
  const [row] = await db
    .select()
    .from(articles)
    .where(eq(articles.slug, slug))
    .limit(1);
  return row ?? null;
}

/** List articles with pagination. Pass `view` for admin tab filtering, `status` for API filtering. */
export async function getArticlesPaginatedFromDb(options: {
  page: number;
  limit: number;
  status?: "draft" | "published";
  view?: string;
}): Promise<{ items: ArticleRow[]; total: number }> {
  const { page, limit, status, view } = options;
  let where: SQL | undefined
  if (view === "published")   where = eq(articles.status, "published")
  else if (view === "drafts") where = eq(articles.status, "draft")
  else if (view === "all")    where = undefined
  else if (status !== undefined) where = eq(articles.status, status)
  const items = await db
    .select()
    .from(articles)
    .where(where)
    .orderBy(desc(articles.updatedAt))
    .limit(limit)
    .offset((page - 1) * limit)
  const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(articles).where(where)
  const total = countResult[0]?.count ?? 0;
  return { items, total };
}

export type ArticleStatusCounts = {
  all: number
  published: number
  draft: number
}

export async function getArticleStatusCountsFromDb(): Promise<ArticleStatusCounts> {
  const rows = await db
    .select({ status: articles.status, count: sql<number>`count(*)::int` })
    .from(articles)
    .groupBy(articles.status)
  const map: Record<string, number> = {}
  for (const r of rows) map[r.status] = r.count
  return {
    all: Object.values(map).reduce((s, n) => s + n, 0),
    published: map["published"] ?? 0,
    draft: map["draft"] ?? 0,
  }
}

export async function createArticleInDb(input: {
  title: string;
  slug: string;
  content: string;
  author: string;
  status: string;
  publishDate?: Date | null;
}): Promise<string> {
  const [inserted] = await db
    .insert(articles)
    .values({
      title: input.title,
      slug: input.slug,
      content: input.content,
      author: input.author,
      status: input.status,
      publishDate: input.publishDate ?? null,
    })
    .returning({ id: articles.id });
  return inserted!.id;
}

export async function updateArticleInDb(
  id: string,
  input: {
    title?: string;
    slug?: string;
    content?: string;
    author?: string;
    status?: string;
    publishDate?: Date | null;
  }
): Promise<boolean> {
  const updates = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined)
  );
  if (Object.keys(updates).length === 0) return true;
  await db.update(articles).set(updates).where(eq(articles.id, id));
  return true;
}

export async function deleteArticleInDb(id: string): Promise<boolean> {
  const deleted = await db
    .delete(articles)
    .where(eq(articles.id, id))
    .returning({ id: articles.id });
  return deleted.length > 0;
}

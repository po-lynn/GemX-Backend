import { db } from "@/drizzle/db";
import { articles } from "@/drizzle/schema/articles-schema";
import { and, eq, ilike, desc, sql, type SQL } from "drizzle-orm";

export type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  content: string;
  author: string;
  category: string;
  coverImage: string | null;
  isFeatured: boolean;
  status: string;
  publishDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getArticleById(id: string): Promise<ArticleRow | null> {
  const [row] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  return row ?? null;
}

/** List articles with pagination. Pass `view` for admin tab filtering, `status` for API filtering. */
export async function getArticlesPaginatedFromDb(options: {
  page: number;
  limit: number;
  status?: "draft" | "published";
  view?: string;
  search?: string;
  category?: string;
  featured?: boolean;
  /** "publish" orders the public feed by publish date; default preserves admin updatedAt order. */
  sort?: "publish" | "updated";
}): Promise<{ items: ArticleRow[]; total: number }> {
  const { page, limit, status, view, search, category, featured, sort } = options;
  let statusWhere: SQL | undefined
  if (view === "published")   statusWhere = eq(articles.status, "published")
  else if (view === "drafts") statusWhere = eq(articles.status, "draft")
  else if (view === "all")    statusWhere = undefined
  else if (status !== undefined) statusWhere = eq(articles.status, status)
  const filters: SQL[] = []
  if (statusWhere) filters.push(statusWhere)
  if (search?.trim()) filters.push(ilike(articles.title, `%${search.trim()}%`))
  if (category) filters.push(eq(articles.category, category))
  if (featured !== undefined) filters.push(eq(articles.isFeatured, featured))
  const where = filters.length > 0 ? and(...filters) : undefined
  const orderBy =
    sort === "publish"
      ? desc(sql`coalesce(${articles.publishDate}, ${articles.createdAt})`)
      : desc(articles.updatedAt)
  const items = await db
    .select()
    .from(articles)
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset((page - 1) * limit)
  const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(articles).where(where)
  const total = countResult[0]?.count ?? 0;
  return { items, total };
}

/** Published-article counts per category for the mobile category chips. */
export async function getArticleCategoryCountsFromDb(): Promise<Record<string, number>> {
  const rows = await db
    .select({ category: articles.category, count: sql<number>`count(*)::int` })
    .from(articles)
    .where(eq(articles.status, "published"))
    .groupBy(articles.category)
  const counts: Record<string, number> = {}
  let all = 0
  for (const r of rows) {
    counts[r.category] = r.count
    all += r.count
  }
  return { all, ...counts }
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
  category?: string;
  coverImage?: string | null;
  isFeatured?: boolean;
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
      ...(input.category !== undefined ? { category: input.category } : {}),
      coverImage: input.coverImage ?? null,
      isFeatured: input.isFeatured ?? false,
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
    category?: string;
    coverImage?: string | null;
    isFeatured?: boolean;
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

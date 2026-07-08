import { db } from "@/drizzle/db";
import { news } from "@/drizzle/schema/news-schema";
import { and, eq, ne, ilike, desc, sql, type SQL } from "drizzle-orm";

export type NewsRow = {
  id: string;
  title: string;
  content: string;
  author: string;
  category: string;
  coverImage: string | null;
  isFeatured: boolean;
  status: string;
  publish: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getNewsById(id: string): Promise<NewsRow | null> {
  const [row] = await db.select().from(news).where(eq(news.id, id)).limit(1);
  return row ?? null;
}

/** Lightweight id-only list, ordered same as the default admin view, for prev/next navigation. */
export async function getAllNewsIdsOrdered(): Promise<{ id: string }[]> {
  return db.select({ id: news.id }).from(news).orderBy(desc(news.updatedAt));
}

/** List news with pagination. Pass `view` for admin tab filtering, `status` for API filtering. */
export async function getNewsPaginatedFromDb(options: {
  page: number;
  limit: number;
  status?: "draft" | "published";
  view?: string;
  search?: string;
  category?: string;
  featured?: boolean;
  /** "publish" orders the public feed by publish date; default preserves admin updatedAt order. */
  sort?: "publish" | "updated";
}): Promise<{ items: NewsRow[]; total: number }> {
  const { page, limit, status, view, search, category, featured, sort } = options;
  let statusWhere: SQL | undefined
  if (view === "published")  statusWhere = eq(news.status, "published")
  else if (view === "scheduled") statusWhere = eq(news.status, "scheduled")
  else if (view === "drafts")    statusWhere = eq(news.status, "draft")
  else if (view === "archived")  statusWhere = eq(news.status, "archived")
  else if (view === "all")       statusWhere = ne(news.status, "archived")
  else if (status !== undefined) statusWhere = eq(news.status, status)
  const filters: SQL[] = []
  if (statusWhere) filters.push(statusWhere)
  if (search?.trim()) filters.push(ilike(news.title, `%${search.trim()}%`))
  if (category) filters.push(eq(news.category, category))
  if (featured !== undefined) filters.push(eq(news.isFeatured, featured))
  const where = filters.length > 0 ? and(...filters) : undefined
  const orderBy =
    sort === "publish"
      ? desc(sql`coalesce(${news.publish}, ${news.createdAt})`)
      : desc(news.updatedAt)
  const items = await db
    .select()
    .from(news)
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset((page - 1) * limit)
  const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(news).where(where)
  const total = countResult[0]?.count ?? 0;
  return { items, total };
}

/** Published-news counts per category for the mobile category chips ("All 9, Market 4, ..."). */
export async function getNewsCategoryCountsFromDb(): Promise<Record<string, number>> {
  const rows = await db
    .select({ category: news.category, count: sql<number>`count(*)::int` })
    .from(news)
    .where(eq(news.status, "published"))
    .groupBy(news.category)
  const counts: Record<string, number> = {}
  let all = 0
  for (const r of rows) {
    counts[r.category] = r.count
    all += r.count
  }
  return { all, ...counts }
}

export type NewsStatusCounts = {
  all: number
  published: number
  scheduled: number
  draft: number
  archived: number
}

export async function getNewsStatusCountsFromDb(): Promise<NewsStatusCounts> {
  const rows = await db
    .select({ status: news.status, count: sql<number>`count(*)::int` })
    .from(news)
    .groupBy(news.status)
  const map: Record<string, number> = {}
  for (const r of rows) map[r.status] = r.count
  const archived = map["archived"] ?? 0
  const total = Object.values(map).reduce((s, n) => s + n, 0)
  return {
    all: total - archived,
    published: map["published"] ?? 0,
    scheduled: map["scheduled"] ?? 0,
    draft: map["draft"] ?? 0,
    archived,
  }
}

export async function createNewsInDb(input: {
  title: string;
  content: string;
  status: string;
  publish?: Date | null;
  author?: string;
  category?: string;
  coverImage?: string | null;
  isFeatured?: boolean;
}): Promise<string> {
  const [inserted] = await db
    .insert(news)
    .values({
      title: input.title,
      content: input.content,
      status: input.status,
      publish: input.publish ?? null,
      ...(input.author !== undefined ? { author: input.author } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      coverImage: input.coverImage ?? null,
      isFeatured: input.isFeatured ?? false,
    })
    .returning({ id: news.id });
  return inserted!.id;
}

export async function updateNewsInDb(
  id: string,
  input: {
    title?: string;
    content?: string;
    status?: string;
    publish?: Date | null;
    author?: string;
    category?: string;
    coverImage?: string | null;
    isFeatured?: boolean;
  }
): Promise<boolean> {
  const updates = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined)
  );
  if (Object.keys(updates).length === 0) return true;
  await db.update(news).set(updates).where(eq(news.id, id));
  return true;
}

export async function deleteNewsInDb(id: string): Promise<boolean> {
  const deleted = await db
    .delete(news)
    .where(eq(news.id, id))
    .returning({ id: news.id });
  return deleted.length > 0;
}

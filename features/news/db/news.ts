import { db } from "@/drizzle/db";
import { news } from "@/drizzle/schema/news-schema";
import { eq, ne, desc, sql, type SQL } from "drizzle-orm";

export type NewsRow = {
  id: string;
  title: string;
  content: string;
  status: string;
  publish: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getAllNewsFromDb(): Promise<NewsRow[]> {
  return db.select().from(news).orderBy(desc(news.updatedAt));
}

export async function getNewsById(id: string): Promise<NewsRow | null> {
  const [row] = await db.select().from(news).where(eq(news.id, id)).limit(1);
  return row ?? null;
}

/** List news with pagination. Pass `view` for admin tab filtering, `status` for API filtering. */
export async function getNewsPaginatedFromDb(options: {
  page: number;
  limit: number;
  status?: "draft" | "published";
  view?: string;
}): Promise<{ items: NewsRow[]; total: number }> {
  const { page, limit, status, view } = options;
  let where: SQL | undefined
  if (view === "published")  where = eq(news.status, "published")
  else if (view === "scheduled") where = eq(news.status, "scheduled")
  else if (view === "drafts")    where = eq(news.status, "draft")
  else if (view === "archived")  where = eq(news.status, "archived")
  else if (view === "all")       where = ne(news.status, "archived")
  else if (status !== undefined) where = eq(news.status, status)
  const items = await db
    .select()
    .from(news)
    .where(where)
    .orderBy(desc(news.updatedAt))
    .limit(limit)
    .offset((page - 1) * limit)
  const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(news).where(where)
  const total = countResult[0]?.count ?? 0;
  return { items, total };
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
}): Promise<string> {
  const [inserted] = await db
    .insert(news)
    .values({
      title: input.title,
      content: input.content,
      status: input.status,
      publish: input.publish ?? null,
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

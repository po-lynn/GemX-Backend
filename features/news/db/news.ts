import { db } from "@/drizzle/db";
import { news } from "@/drizzle/schema/news-schema";
import { newsTranslation } from "@/drizzle/schema/news-translation-schema";
import { eq, desc, sql } from "drizzle-orm";

export type NewsRow = {
  id: string;
  title: string;
  language: "Myanmar" | "English" | "Thai" | "Korean";
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

/** List news with pagination. Optional status filter (omit for all). */
export async function getNewsPaginatedFromDb(options: {
  page: number;
  limit: number;
  status?: "draft" | "published";
}): Promise<{ items: NewsRow[]; total: number }> {
  const { page, limit, status } = options;
  const where = status === undefined ? undefined : eq(news.status, status);
  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(news)
      .where(where)
      .orderBy(desc(news.publish ?? news.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit),
    where
      ? db.select({ count: sql<number>`count(*)::int` }).from(news).where(where)
      : db.select({ count: sql<number>`count(*)::int` }).from(news),
  ]);
  const total = countResult[0]?.count ?? 0;
  return { items, total };
}

export async function createNewsInDb(input: {
  title: string;
  language: "Myanmar" | "English" | "Thai" | "Korean";
  content: string;
  status: string;
  publish?: Date | null;
}): Promise<string> {
  const [inserted] = await db
    .insert(news)
    .values({
      title: input.title,
      language: input.language,
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
    language?: "Myanmar" | "English" | "Thai" | "Korean";
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

export async function createNewsTranslationsInDb(
  items: Array<{
    newsId: string;
    language: "Myanmar" | "English" | "Thai" | "Korean";
    title: string;
    content: string;
  }>
): Promise<void> {
  if (items.length === 0) return;
  await db
    .insert(newsTranslation)
    .values(
      items.map((item) => ({
        newsId: item.newsId,
        language: item.language,
        title: item.title,
        content: item.content,
      }))
    )
    .onConflictDoUpdate({
      target: [newsTranslation.newsId, newsTranslation.language],
      set: {
        title: sql`excluded.title`,
        content: sql`excluded.content`,
        updatedAt: new Date(),
      },
    });
}

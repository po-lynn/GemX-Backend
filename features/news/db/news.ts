import { db } from "@/drizzle/db";
import { news } from "@/drizzle/schema/news-schema";
import { eq, desc } from "drizzle-orm";

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

import { db } from "@/drizzle/db";
import { articles } from "@/drizzle/schema/articles-schema";
import { eq, desc, sql } from "drizzle-orm";

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

/** List articles with pagination. Optional status filter (default: only published). */
export async function getArticlesPaginatedFromDb(options: {
  page: number;
  limit: number;
  status?: "draft" | "published";
}): Promise<{ items: ArticleRow[]; total: number }> {
  const { page, limit, status = "published" } = options;
  const where = eq(articles.status, status);
  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(articles)
      .where(where)
      .orderBy(desc(articles.publishDate ?? articles.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: sql<number>`count(*)::int` }).from(articles).where(where),
  ]);
  const total = countResult[0]?.count ?? 0;
  return { items, total };
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

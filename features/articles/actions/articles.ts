"use server";

import { z } from "zod";
import { canAdminManageArticles } from "@/features/articles/permissions/articles";
import {
  articleCreateSchema,
  articleUpdateSchema,
  articleDeleteSchema,
} from "@/features/articles/schemas/articles";
import {
  createArticleInDb,
  updateArticleInDb,
  deleteArticleInDb,
  getArticleById,
} from "@/features/articles/db/articles";
import { sendArticlePublishedNotification } from "@/features/notifications/services/global-push";
import { emptyToNull, zodErrorMessage } from "@/lib/form-data";
import { requireActionRole } from "@/lib/action-guard";


function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "article";
}

export async function createArticleAction(formData: FormData) {
  const parsed = articleCreateSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content") ?? "[]",
    author: formData.get("author") ?? "",
    category: formData.get("category") || "general",
    coverImage: emptyToNull(formData.get("coverImage")),
    isFeatured: formData.get("isFeatured") === "true",
    status: formData.get("status") || "draft",
    publishDate: emptyToNull(formData.get("publishDate")),
  });
  if (!parsed.success) {
    return {
      error: zodErrorMessage(parsed.error),
    };
  }
  const session = await requireActionRole(canAdminManageArticles);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const publishDate =
    parsed.data.publishDate && String(parsed.data.publishDate).trim()
      ? new Date(parsed.data.publishDate)
      : null;
  const articleId = await createArticleInDb({
    title: parsed.data.title,
    slug: slugify(parsed.data.title),
    content: parsed.data.content,
    author: parsed.data.author.trim(),
    category: parsed.data.category,
    coverImage: parsed.data.coverImage,
    isFeatured: parsed.data.isFeatured,
    status: parsed.data.status,
    publishDate,
  });
  if (parsed.data.status === "published") {
    sendArticlePublishedNotification({ articleId, title: parsed.data.title }).catch((e) =>
      console.error("Global article push failed:", e)
    );
  }
  return { success: true, articleId };
}

export async function updateArticleAction(formData: FormData) {
  const parsed = articleUpdateSchema.safeParse({
    articleId: formData.get("articleId"),
    title: emptyToNull(formData.get("title")),
    content: emptyToNull(formData.get("content")),
    author: formData.get("author") ?? undefined,
    category: emptyToNull(formData.get("category")) ?? undefined,
    coverImage: formData.has("coverImage")
      ? emptyToNull(formData.get("coverImage"))
      : undefined,
    isFeatured: formData.has("isFeatured")
      ? formData.get("isFeatured") === "true"
      : undefined,
    status: emptyToNull(formData.get("status")),
    publishDate: emptyToNull(formData.get("publishDate")),
  });
  if (!parsed.success) {
    return {
      error: zodErrorMessage(parsed.error),
    };
  }
  const session = await requireActionRole(canAdminManageArticles);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const { articleId, publishDate: publishDateRaw, title, ...rest } = parsed.data;
  const publishDate: Date | null | undefined =
    publishDateRaw === undefined
      ? undefined
      : publishDateRaw && String(publishDateRaw).trim()
        ? new Date(publishDateRaw)
        : null;
  const updates: Parameters<typeof updateArticleInDb>[1] = {
    ...rest,
    publishDate,
  };
  if (title !== undefined) {
    updates.title = title;
    updates.slug = slugify(title);
  }
  const previous = await getArticleById(articleId);
  await updateArticleInDb(articleId, updates);
  if (updates.status === "published" && previous?.status !== "published") {
    const articleTitle = updates.title ?? previous?.title ?? "New article";
    sendArticlePublishedNotification({ articleId, title: articleTitle }).catch((e) =>
      console.error("Global article push failed:", e)
    );
  }
  return { success: true, articleId };
}

export async function autoSaveArticleAction(formData: FormData) {
  const parsed = z
    .object({
      articleId: z.string().uuid(),
      title: z.string().min(1, "Title is required").max(500),
      author: z.string().max(200),
      content: z.string().max(500_000),
    })
    .safeParse({
      articleId: formData.get("articleId"),
      title: formData.get("title"),
      author: formData.get("author") ?? "",
      content: formData.get("content") ?? "[]",
    });
  if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
  const session = await requireActionRole(canAdminManageArticles);
  if (!session) return { error: "Unauthorized" };
  await updateArticleInDb(parsed.data.articleId, {
    title: parsed.data.title,
    author: parsed.data.author,
    content: parsed.data.content,
  });
  return { success: true };
}

export async function deleteArticleAction(formData: FormData) {
  const parsed = articleDeleteSchema.safeParse({
    articleId: formData.get("articleId"),
  });
  if (!parsed.success) return { error: "Invalid input" };
  const session = await requireActionRole(canAdminManageArticles);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const deleted = await deleteArticleInDb(parsed.data.articleId);
  if (!deleted) return { error: "Article not found" };
  return { success: true };
}

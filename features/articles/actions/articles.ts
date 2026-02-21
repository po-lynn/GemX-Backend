"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
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
} from "@/features/articles/db/articles";

function emptyToNull<T>(v: T): T | null | undefined {
  return v === "" ? null : (v ?? undefined);
}

export async function createArticleAction(formData: FormData) {
  const parsed = articleCreateSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    content: formData.get("content") ?? "[]",
    author: formData.get("author") ?? "",
    status: formData.get("status") || "draft",
    publishDate: emptyToNull(formData.get("publishDate")),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.flatten().formErrors.join(", ") || "Invalid input",
    };
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageArticles(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const publishDate =
    parsed.data.publishDate && String(parsed.data.publishDate).trim()
      ? new Date(parsed.data.publishDate)
      : null;
  const articleId = await createArticleInDb({
    title: parsed.data.title,
    slug: parsed.data.slug.trim().toLowerCase(),
    content: parsed.data.content,
    author: parsed.data.author.trim(),
    status: parsed.data.status,
    publishDate,
  });
  return { success: true, articleId };
}

export async function updateArticleAction(formData: FormData) {
  const parsed = articleUpdateSchema.safeParse({
    articleId: formData.get("articleId"),
    title: emptyToNull(formData.get("title")),
    slug: emptyToNull(formData.get("slug")),
    content: emptyToNull(formData.get("content")),
    author: emptyToNull(formData.get("author")),
    status: emptyToNull(formData.get("status")),
    publishDate: emptyToNull(formData.get("publishDate")),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.flatten().formErrors.join(", ") || "Invalid input",
    };
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageArticles(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const { articleId, publishDate: publishDateRaw, ...rest } = parsed.data;
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
  if (rest.slug !== undefined) {
    updates.slug = rest.slug.trim().toLowerCase();
  }
  await updateArticleInDb(articleId, updates);
  return { success: true, articleId };
}

export async function deleteArticleAction(formData: FormData) {
  const parsed = articleDeleteSchema.safeParse({
    articleId: formData.get("articleId"),
  });
  if (!parsed.success) return { error: "Invalid input" };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageArticles(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const deleted = await deleteArticleInDb(parsed.data.articleId);
  if (!deleted) return { error: "Article not found" };
  return { success: true };
}

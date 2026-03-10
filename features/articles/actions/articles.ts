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
  getArticleById,
} from "@/features/articles/db/articles";
import { sendPushToMobileUsers } from "@/features/push/send-push";

function emptyToNull<T>(v: T): T | null | undefined {
  return v === "" ? null : (v ?? undefined);
}

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
    slug: slugify(parsed.data.title),
    content: parsed.data.content,
    author: parsed.data.author.trim(),
    status: parsed.data.status,
    publishDate,
  });
  if (parsed.data.status === "published") {
    sendPushToMobileUsers({
      title: "New article",
      body: parsed.data.title,
      data: { articleId, screen: "article" },
    }).catch((e) => console.error("Push notification failed:", e));
  }
  return { success: true, articleId };
}

export async function updateArticleAction(formData: FormData) {
  const parsed = articleUpdateSchema.safeParse({
    articleId: formData.get("articleId"),
    title: emptyToNull(formData.get("title")),
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
    sendPushToMobileUsers({
      title: "New article",
      body: articleTitle,
      data: { articleId, screen: "article" },
    }).catch((e) => console.error("Push notification failed:", e));
  }
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

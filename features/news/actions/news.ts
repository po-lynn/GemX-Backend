"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { canAdminManageNews } from "@/features/news/permissions/news";
import {
  newsCreateSchema,
  newsUpdateSchema,
  newsDeleteSchema,
} from "@/features/news/schemas/news";
import {
  createNewsInDb,
  updateNewsInDb,
  deleteNewsInDb,
} from "@/features/news/db/news";

function emptyToNull<T>(v: T): T | null | undefined {
  return v === "" ? null : (v ?? undefined);
}

export async function createNewsAction(formData: FormData) {
  const parsed = newsCreateSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content") ?? "[]",
    status: formData.get("status") || "draft",
    publish: emptyToNull(formData.get("publish")),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.flatten().formErrors.join(", ") || "Invalid input",
    };
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageNews(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const publishDate =
    parsed.data.publish && String(parsed.data.publish).trim()
      ? new Date(parsed.data.publish)
      : null;
  const newsId = await createNewsInDb({
    title: parsed.data.title,
    content: parsed.data.content,
    status: parsed.data.status,
    publish: publishDate,
  });
  return { success: true, newsId };
}

export async function updateNewsAction(formData: FormData) {
  const parsed = newsUpdateSchema.safeParse({
    newsId: formData.get("newsId"),
    title: emptyToNull(formData.get("title")),
    content: emptyToNull(formData.get("content")),
    status: emptyToNull(formData.get("status")),
    publish: emptyToNull(formData.get("publish")),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.flatten().formErrors.join(", ") || "Invalid input",
    };
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageNews(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const { newsId, publish, ...rest } = parsed.data;
  const updates: Parameters<typeof updateNewsInDb>[1] = { ...rest };
  if (publish !== undefined) {
    updates.publish =
      publish && String(publish).trim() ? new Date(publish) : null;
  }
  await updateNewsInDb(newsId, updates);
  return { success: true, newsId };
}

export async function deleteNewsAction(formData: FormData) {
  const parsed = newsDeleteSchema.safeParse({
    newsId: formData.get("newsId"),
  });
  if (!parsed.success) return { error: "Invalid input" };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageNews(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const deleted = await deleteNewsInDb(parsed.data.newsId);
  if (!deleted) return { error: "News not found" };
  return { success: true };
}

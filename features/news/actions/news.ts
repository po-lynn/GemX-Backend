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
  getNewsById,
} from "@/features/news/db/news";
import { sendNewsPublishedNotification } from "@/features/notifications/services/global-push";

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
  if (parsed.data.status === "published") {
    sendNewsPublishedNotification({ newsId, title: parsed.data.title }).catch((e) =>
      console.error("Global news push failed:", e)
    );
  }
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
  const { newsId, publish: publishRaw, ...rest } = parsed.data;
  const publish: Date | null | undefined =
    publishRaw === undefined
      ? undefined
      : publishRaw && String(publishRaw).trim()
        ? new Date(publishRaw)
        : null;
  const updates: Parameters<typeof updateNewsInDb>[1] = { ...rest, publish };
  const previous = await getNewsById(newsId);
  await updateNewsInDb(newsId, updates);
  if (updates.status === "published" && previous?.status !== "published") {
    const newsTitle = updates.title ?? previous?.title ?? "New news";
    sendNewsPublishedNotification({ newsId, title: newsTitle }).catch((e) =>
      console.error("Global news push failed:", e)
    );
  }
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

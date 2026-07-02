"use server";

import { z } from "zod";
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
import { emptyToNull, zodErrorMessage } from "@/lib/form-data";
import { requireActionRole } from "@/lib/action-guard";


export async function createNewsAction(formData: FormData) {
  const parsed = newsCreateSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content") ?? "[]",
    author: formData.get("author") || "Gem X Newsroom",
    category: formData.get("category") || "general",
    coverImage: emptyToNull(formData.get("coverImage")),
    isFeatured: formData.get("isFeatured") === "true",
    status: formData.get("status") || "draft",
    publish: emptyToNull(formData.get("publish")),
  });
  if (!parsed.success) {
    return {
      error: zodErrorMessage(parsed.error),
    };
  }
  const session = await requireActionRole(canAdminManageNews);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const publishDate =
    parsed.data.publish && String(parsed.data.publish).trim()
      ? new Date(parsed.data.publish)
      : null;
  const newsId = await createNewsInDb({
    title: parsed.data.title,
    content: parsed.data.content,
    author: parsed.data.author,
    category: parsed.data.category,
    coverImage: parsed.data.coverImage,
    isFeatured: parsed.data.isFeatured,
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
    author: emptyToNull(formData.get("author")) ?? undefined,
    category: emptyToNull(formData.get("category")) ?? undefined,
    coverImage: formData.has("coverImage")
      ? emptyToNull(formData.get("coverImage"))
      : undefined,
    isFeatured: formData.has("isFeatured")
      ? formData.get("isFeatured") === "true"
      : undefined,
    status: emptyToNull(formData.get("status")),
    publish: emptyToNull(formData.get("publish")),
  });
  if (!parsed.success) {
    return {
      error: zodErrorMessage(parsed.error),
    };
  }
  const session = await requireActionRole(canAdminManageNews);
  if (!session) {
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
  const session = await requireActionRole(canAdminManageNews);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const deleted = await deleteNewsInDb(parsed.data.newsId);
  if (!deleted) return { error: "News not found" };
  return { success: true };
}

export async function autoSaveNewsAction(formData: FormData) {
  const parsed = z
    .object({
      newsId: z.string().uuid(),
      title: z.string().min(1, "Title is required").max(500),
      content: z.string().max(500_000),
    })
    .safeParse({
      newsId: formData.get("newsId"),
      title: formData.get("title"),
      content: formData.get("content") ?? "[]",
    });
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) };
  }
  const session = await requireActionRole(canAdminManageNews);
  if (!session) {
    return { error: "Unauthorized" };
  }
  await updateNewsInDb(parsed.data.newsId, {
    title: parsed.data.title,
    content: parsed.data.content,
  });
  return { success: true };
}

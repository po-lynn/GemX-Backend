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
import { buildLocalizedNews, localizedFieldsForLanguage } from "@/features/news/services/google-translate";
import type { NewsLanguage } from "@/features/news/services/google-translate";
import { sendNewsPublishedNotification } from "@/features/notifications/services/global-push";
import { emptyToNull, zodErrorMessage } from "@/lib/form-data";
import { requireActionRole } from "@/lib/action-guard";
import { revalidateNewsCache } from "@/features/news/db/cache/news";

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

  let localized: Awaited<ReturnType<typeof buildLocalizedNews>>;
  try {
    localized = await buildLocalizedNews(parsed.data.title, parsed.data.content);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Translation failed";
    return { error: message };
  }

  const publishDate =
    parsed.data.publish && String(parsed.data.publish).trim()
      ? new Date(parsed.data.publish)
      : null;
  const newsId = await createNewsInDb({
    title: localized.title,
    content: localized.content,
    author: parsed.data.author,
    category: parsed.data.category,
    coverImage: parsed.data.coverImage,
    isFeatured: parsed.data.isFeatured,
    status: parsed.data.status,
    publish: publishDate,
    language: localized.sourceLanguage,
    titleEn: localized.titleEn,
    titleMy: localized.titleMy,
    titleTh: localized.titleTh,
    titleKo: localized.titleKo,
    contentEn: localized.contentEn,
    contentMy: localized.contentMy,
    contentTh: localized.contentTh,
    contentKo: localized.contentKo,
  });
  revalidateNewsCache();
  if (parsed.data.status === "published") {
    sendNewsPublishedNotification({ newsId, title: localized.title }).catch((e) =>
      console.error("Global news push failed:", e)
    );
  }
  return { success: true, newsId, language: localized.sourceLanguage };
}

export async function updateNewsAction(formData: FormData) {
  const parsed = newsUpdateSchema.safeParse({
    newsId: formData.get("newsId"),
    title: emptyToNull(formData.get("title")),
    content: emptyToNull(formData.get("content")),
    editLanguage: emptyToNull(formData.get("editLanguage")) ?? undefined,
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
  const { newsId, publish: publishRaw, editLanguage, title, content, ...rest } =
    parsed.data;
  const publish: Date | null | undefined =
    publishRaw === undefined
      ? undefined
      : publishRaw && String(publishRaw).trim()
        ? new Date(publishRaw)
        : null;
  const previous = await getNewsById(newsId);
  const updates: Parameters<typeof updateNewsInDb>[1] = { ...rest, publish };

  if (editLanguage && title !== undefined && content !== undefined) {
    Object.assign(
      updates,
      localizedFieldsForLanguage(
        editLanguage as NewsLanguage,
        title,
        content,
        previous?.language,
      ),
    );
  } else {
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
  }

  await updateNewsInDb(newsId, updates);
  revalidateNewsCache();
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
  revalidateNewsCache();
  return { success: true };
}

export async function autoSaveNewsAction(formData: FormData) {
  const parsed = z
    .object({
      newsId: z.string().uuid(),
      title: z.string().min(1, "Title is required").max(500),
      content: z.string().max(500_000),
      editLanguage: z.enum(["English", "Myanmar", "Thai", "Korean"]).optional(),
    })
    .safeParse({
      newsId: formData.get("newsId"),
      title: formData.get("title"),
      content: formData.get("content") ?? "[]",
      editLanguage: formData.get("editLanguage") || undefined,
    });
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) };
  }
  const session = await requireActionRole(canAdminManageNews);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const previous = await getNewsById(parsed.data.newsId);
  const updates = parsed.data.editLanguage
    ? localizedFieldsForLanguage(
        parsed.data.editLanguage,
        parsed.data.title,
        parsed.data.content,
        previous?.language,
      )
    : {
        title: parsed.data.title,
        content: parsed.data.content,
      };
  await updateNewsInDb(parsed.data.newsId, updates);
  return { success: true };
}

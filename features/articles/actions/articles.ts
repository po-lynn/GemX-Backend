"use server";

import { z } from "zod";
import { after } from "next/server";
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
import {
  buildLocalizedNews,
  localizedFieldsForLanguage,
  type NewsLanguage,
} from "@/features/news/services/google-translate";
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

  let localized: Awaited<ReturnType<typeof buildLocalizedNews>>;
  try {
    localized = await buildLocalizedNews(parsed.data.title, parsed.data.content);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Translation failed";
    return { error: message };
  }

  const publishDate =
    parsed.data.publishDate && String(parsed.data.publishDate).trim()
      ? new Date(parsed.data.publishDate)
      : null;
  const articleId = await createArticleInDb({
    title: localized.title,
    slug: slugify(localized.title),
    content: localized.content,
    author: parsed.data.author.trim(),
    category: parsed.data.category,
    coverImage: parsed.data.coverImage,
    isFeatured: parsed.data.isFeatured,
    status: parsed.data.status,
    publishDate,
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
  if (parsed.data.status === "published") {
    after(() =>
      sendArticlePublishedNotification({ articleId, title: localized.title }).catch((e) =>
        console.error("Global article push failed:", e)
      )
    );
  }
  return { success: true, articleId, language: localized.sourceLanguage };
}

export async function updateArticleAction(formData: FormData) {
  const parsed = articleUpdateSchema.safeParse({
    articleId: formData.get("articleId"),
    title: emptyToNull(formData.get("title")),
    content: emptyToNull(formData.get("content")),
    editLanguage: emptyToNull(formData.get("editLanguage")) ?? undefined,
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
  const {
    articleId,
    publishDate: publishDateRaw,
    editLanguage,
    title,
    content,
    ...rest
  } = parsed.data;
  const publishDate: Date | null | undefined =
    publishDateRaw === undefined
      ? undefined
      : publishDateRaw && String(publishDateRaw).trim()
        ? new Date(publishDateRaw)
        : null;
  const previous = await getArticleById(articleId);
  const updates: Parameters<typeof updateArticleInDb>[1] = {
    ...rest,
    publishDate,
  };

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

  // Only regenerate slug when the canonical source title changes.
  if (updates.title !== undefined) {
    updates.slug = slugify(updates.title);
  }

  const { justPublished, title: publishedTitle } = await updateArticleInDb(articleId, updates);
  if (justPublished) {
    after(() =>
      sendArticlePublishedNotification({
        articleId,
        title: publishedTitle ?? updates.title ?? previous?.title ?? "New article",
      }).catch((e) => console.error("Global article push failed:", e))
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
      editLanguage: z.enum(["English", "Myanmar", "Thai", "Korean"]).optional(),
    })
    .safeParse({
      articleId: formData.get("articleId"),
      title: formData.get("title"),
      author: formData.get("author") ?? "",
      content: formData.get("content") ?? "[]",
      editLanguage: formData.get("editLanguage") || undefined,
    });
  if (!parsed.success) return { error: zodErrorMessage(parsed.error) };
  const session = await requireActionRole(canAdminManageArticles);
  if (!session) return { error: "Unauthorized" };

  const previous = await getArticleById(parsed.data.articleId);
  const updates: Parameters<typeof updateArticleInDb>[1] = {
    author: parsed.data.author,
  };

  if (parsed.data.editLanguage) {
    Object.assign(
      updates,
      localizedFieldsForLanguage(
        parsed.data.editLanguage,
        parsed.data.title,
        parsed.data.content,
        previous?.language,
      ),
    );
  } else {
    updates.title = parsed.data.title;
    updates.content = parsed.data.content;
  }

  // Only regenerate slug when the canonical source title changes.
  if (updates.title !== undefined) {
    updates.slug = slugify(updates.title);
  }

  await updateArticleInDb(parsed.data.articleId, updates);
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

"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidateCategoriesCache } from "@/features/categories/db/cache/categories"
import { canAdminManageCategories } from "@/features/categories/permissions/categories"
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  categoryDeleteSchema,
} from "@/features/categories/schemas/categories"
import {
  createCategoryInDb,
  updateCategoryInDb,
  deleteCategoryInDb,
} from "@/features/categories/db/categories"

function emptyToNull<T>(v: T): T | null | undefined {
  return v === "" ? null : (v ?? undefined)
}

export async function createCategoryAction(formData: FormData) {
  const parsed = categoryCreateSchema.safeParse({
    name: formData.get("name"),
    slug: emptyToNull(formData.get("slug")),
    parentId: emptyToNull(formData.get("parentId")),
    description: emptyToNull(formData.get("description")),
    sortOrder: formData.get("sortOrder") ?? undefined,
    speciesIds: formData.getAll("speciesIds").filter(Boolean),
  })

  if (!parsed.success) {
    return {
      error: parsed.error.flatten().formErrors.join(", ") || "Invalid input",
    }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canAdminManageCategories(session.user.role)) {
    return { error: "Unauthorized" }
  }

  const categoryId = await createCategoryInDb({
    name: parsed.data.name,
    slug: parsed.data.slug,
    parentId: parsed.data.parentId,
    description: parsed.data.description,
    sortOrder: parsed.data.sortOrder,
    speciesIds: parsed.data.speciesIds,
  })

  revalidateCategoriesCache()
  return { success: true, categoryId }
}

export async function updateCategoryAction(formData: FormData) {
  const parsed = categoryUpdateSchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name") || undefined,
    slug: emptyToNull(formData.get("slug")),
    parentId: emptyToNull(formData.get("parentId")),
    description: emptyToNull(formData.get("description")),
    sortOrder: formData.get("sortOrder") ?? undefined,
    speciesIds: formData.getAll("speciesIds").filter(Boolean),
  })

  if (!parsed.success) {
    return {
      error: parsed.error.flatten().formErrors.join(", ") || "Invalid input",
    }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canAdminManageCategories(session.user.role)) {
    return { error: "Unauthorized" }
  }

  const { categoryId, ...data } = parsed.data
  await updateCategoryInDb(categoryId, {
    name: data.name,
    slug: data.slug,
    parentId: data.parentId,
    description: data.description,
    sortOrder: data.sortOrder,
    speciesIds: data.speciesIds,
  })

  revalidateCategoriesCache()
  return { success: true, categoryId }
}

export async function deleteCategoryAction(formData: FormData) {
  const parsed = categoryDeleteSchema.safeParse({
    categoryId: formData.get("categoryId"),
  })

  if (!parsed.success) {
    return { error: "Invalid input" }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canAdminManageCategories(session.user.role)) {
    return { error: "Unauthorized" }
  }

  const deleted = await deleteCategoryInDb(parsed.data.categoryId)
  if (!deleted) return { error: "Category not found" }

  revalidateCategoriesCache()
  return { success: true }
}

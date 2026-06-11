"use server"

import { canAdminManageCategories } from "@/features/products/permissions/products"
import { categoryCreateSchema, categoryUpdateSchema, categoryDeleteSchema } from "@/features/categories/schemas/categories"
import {
  createCategoryInDb,
  updateCategoryInDb,
  deleteCategoryInDb,
} from "@/features/categories/db/categories"
import { zodErrorMessage } from "@/lib/form-data"
import { requireActionRole } from "@/lib/action-guard"

function toSlug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
}

export async function createCategoryAction(formData: FormData) {
  const parsed = categoryCreateSchema.safeParse({
    type: formData.get("type"),
    name: formData.get("name"),
    shortCode: formData.get("shortCode"),
    image: formData.get("image"),
    sortOrder: formData.get("sortOrder"),
  })
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) }
  }

  const session = await requireActionRole(canAdminManageCategories)
  if (!session) {
    return { error: "Unauthorized" }
  }

  try {
    await createCategoryInDb({
      ...parsed.data,
      slug: toSlug(parsed.data.name),
    })
    return { success: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create category"
    return { error: message }
  }
}

export async function updateCategoryAction(formData: FormData) {
  const parsed = categoryUpdateSchema.safeParse({
    id: formData.get("id"),
    type: formData.get("type"),
    name: formData.get("name"),
    shortCode: formData.get("shortCode"),
    image: formData.get("image"),
    sortOrder: formData.get("sortOrder"),
  })
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) }
  }

  const session = await requireActionRole(canAdminManageCategories)
  if (!session) {
    return { error: "Unauthorized" }
  }

  const { id, ...data } = parsed.data
  const updatePayload =
    data.name !== undefined ? { ...data, slug: toSlug(data.name) } : data
  try {
    await updateCategoryInDb(id, updatePayload)
    return { success: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update category"
    return { error: message }
  }
}

export async function deleteCategoryAction(formData: FormData) {
  const parsed = categoryDeleteSchema.safeParse({
    id: formData.get("id"),
  })
  if (!parsed.success) {
    return { error: "Invalid input" }
  }

  const session = await requireActionRole(canAdminManageCategories)
  if (!session) {
    return { error: "Unauthorized" }
  }

  const deleted = await deleteCategoryInDb(parsed.data.id)
  if (!deleted) return { error: "Category not found" }
  return { success: true }
}

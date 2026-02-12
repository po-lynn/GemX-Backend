"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { canAdminManageProducts } from "@/features/products/permissions/products"
import { categoryCreateSchema, categoryUpdateSchema } from "@/features/categories/schemas/categories"
import {
  createCategoryInDb,
  updateCategoryInDb,
} from "@/features/categories/db/categories"

function toSlug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
}

export async function createCategoryAction(formData: FormData) {
  const name = formData.get("name")?.toString() ?? ""
  const slugInput = formData.get("slug")?.toString()?.trim()
  const parsed = categoryCreateSchema.safeParse({
    type: formData.get("type"),
    name,
    slug: slugInput ? toSlug(slugInput) : toSlug(name),
    sortOrder: formData.get("sortOrder"),
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canAdminManageProducts(session.user.role)) {
    return { error: "Unauthorized" }
  }

  try {
    await createCategoryInDb(parsed.data)
    return { success: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create category"
    return { error: message }
  }
}

export async function updateCategoryAction(formData: FormData) {
  const name = formData.get("name")?.toString() ?? ""
  const slugInput = formData.get("slug")?.toString()?.trim()
  const parsed = categoryUpdateSchema.safeParse({
    id: formData.get("id"),
    type: formData.get("type"),
    name,
    slug: slugInput ? toSlug(slugInput) : toSlug(name),
    sortOrder: formData.get("sortOrder"),
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canAdminManageProducts(session.user.role)) {
    return { error: "Unauthorized" }
  }

  const { id, ...data } = parsed.data
  try {
    await updateCategoryInDb(id, data)
    return { success: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update category"
    return { error: message }
  }
}

"use server"

import { revalidateProductShapeCache } from "@/features/product-shape/db/cache/product-shape"
import { canAdminManageProductShape } from "@/features/product-shape/permissions/product-shape"
import {
  productShapeCreateSchema,
  productShapeUpdateSchema,
  productShapeDeleteSchema,
} from "@/features/product-shape/schemas/product-shape"
import {
  createProductShapeInDb,
  updateProductShapeInDb,
  deleteProductShapeInDb,
} from "@/features/product-shape/db/product-shape"
import { emptyToNull, zodErrorMessage } from "@/lib/form-data"
import { requireActionRole } from "@/lib/action-guard"

export async function createProductShapeAction(formData: FormData) {
  const parsed = productShapeCreateSchema.safeParse({
    name: emptyToNull(formData.get("name")),
  })
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) }
  }
  const session = await requireActionRole(canAdminManageProductShape)
  if (!session) {
    return { error: "Unauthorized" }
  }
  const productShapeId = await createProductShapeInDb({
    name: parsed.data.name,
  })
  revalidateProductShapeCache()
  return { success: true, productShapeId }
}

export async function updateProductShapeAction(formData: FormData) {
  const parsed = productShapeUpdateSchema.safeParse({
    productShapeId: formData.get("productShapeId"),
    name: emptyToNull(formData.get("name")),
  })
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) }
  }
  const session = await requireActionRole(canAdminManageProductShape)
  if (!session) {
    return { error: "Unauthorized" }
  }
  const { productShapeId, ...data } = parsed.data
  await updateProductShapeInDb(productShapeId, data)
  revalidateProductShapeCache(productShapeId)
  return { success: true, productShapeId }
}

export async function deleteProductShapeAction(formData: FormData) {
  const parsed = productShapeDeleteSchema.safeParse({
    productShapeId: formData.get("productShapeId"),
  })
  if (!parsed.success) return { error: "Invalid input" }
  const session = await requireActionRole(canAdminManageProductShape)
  if (!session) {
    return { error: "Unauthorized" }
  }
  const deleted = await deleteProductShapeInDb(parsed.data.productShapeId)
  if (!deleted) return { error: "Product shape not found" }
  revalidateProductShapeCache()
  return { success: true }
}

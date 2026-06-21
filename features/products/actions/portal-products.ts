"use server"

import { requireActionRole } from "@/lib/action-guard"
import {
  createProductInDb,
  updateProductInDb,
  deleteProductInDb,
  getProductById,
} from "@/features/products/db/products"
import { revalidateProductsCache } from "@/features/products/db/cache/products"
import { productCreateSchema, productUpdateSchema } from "@/features/products/schemas/products"
import { normalizeProductBody } from "@/features/products/api/normalize-product-body"

type ActionResult = { ok: true; productId?: string } | { ok: false; error: string; details?: Record<string, string[]> }

export async function createPortalProductAction(input: Record<string, unknown>): Promise<ActionResult> {
  const session = await requireActionRole((role) => role === "portal")
  if (!session) return { ok: false, error: "Unauthorized" }

  const normalized = normalizeProductBody({
    ...input,
    moderationStatus: "pending",
  })
  const parsed = productCreateSchema.safeParse(normalized)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    const msg =
      flat.formErrors.join(", ") ||
      Object.entries(flat.fieldErrors)
        .map(([k, v]) => `${k}: ${(v as string[])?.[0] ?? "invalid"}`)
        .join(", ") ||
      "Invalid input"
    return { ok: false, error: msg, details: flat.fieldErrors as Record<string, string[]> }
  }

  const productId = await createProductInDb({
    ...parsed.data,
    sellerId: session.user.id,
    jewelleryGemstones: Array.isArray(parsed.data.jewelleryGemstones) ? parsed.data.jewelleryGemstones : [],
  })
  revalidateProductsCache(productId)
  return { ok: true, productId }
}

export async function updatePortalProductAction(productId: string, input: Record<string, unknown>): Promise<ActionResult> {
  const session = await requireActionRole((role) => role === "portal")
  if (!session) return { ok: false, error: "Unauthorized" }

  const product = await getProductById(productId)
  if (!product) return { ok: false, error: "Product not found" }
  if (product.sellerId !== session.user.id) return { ok: false, error: "Forbidden" }

  const normalized = normalizeProductBody({
    ...input,
    productId,
    moderationStatus: "pending",
  })
  const parsed = productUpdateSchema.safeParse(normalized)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return { ok: false, error: flat.formErrors.join(", ") || "Invalid input", details: flat.fieldErrors as Record<string, string[]> }
  }

  const { productId: pid, ...data } = parsed.data
  await updateProductInDb(
    pid,
    data,
    { actorId: session.user.id }
  )
  revalidateProductsCache(pid)
  return { ok: true, productId: pid }
}

export async function deletePortalProductAction(productId: string): Promise<ActionResult> {
  const session = await requireActionRole((role) => role === "portal")
  if (!session) return { ok: false, error: "Unauthorized" }

  const product = await getProductById(productId)
  if (!product) return { ok: false, error: "Product not found" }
  if (product.sellerId !== session.user.id) return { ok: false, error: "Forbidden" }

  const deleted = await deleteProductInDb(productId)
  if (!deleted) return { ok: false, error: "Product not found" }
  revalidateProductsCache(productId)
  return { ok: true }
}

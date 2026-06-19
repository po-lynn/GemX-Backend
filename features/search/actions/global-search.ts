"use server"

import { requireActionRole } from "@/lib/action-guard"
import { searchProductsForAdmin } from "@/features/products/db/products"
import { searchUsersForPicker } from "@/features/users/db/users"

export async function globalSearch(q: string) {
  const session = await requireActionRole((role) => role === "admin" || role === "internal")
  if (!session) return { users: [], products: [] }

  const trimmed = q.trim()
  if (trimmed.length < 2) return { users: [], products: [] }

  const [users, products] = await Promise.all([
    searchUsersForPicker(trimmed, 5),
    searchProductsForAdmin(trimmed, 5),
  ])

  return { users, products }
}

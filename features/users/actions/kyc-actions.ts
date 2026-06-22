"use server"

import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireActionRole } from "@/lib/action-guard"
import { canAdminManageUsers } from "@/features/users/permissions/users"

export async function approveUserKycAction(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireActionRole(canAdminManageUsers)
  if (!session) return { ok: false, error: "Unauthorized" }
  try {
    await db
      .update(user)
      .set({ verified: true, updatedAt: new Date() })
      .where(eq(user.id, userId))
    revalidatePath(`/admin/users/${userId}/edit`)
    return { ok: true }
  } catch {
    return { ok: false, error: "Failed to approve" }
  }
}

export async function rejectUserKycAction(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireActionRole(canAdminManageUsers)
  if (!session) return { ok: false, error: "Unauthorized" }
  try {
    await db
      .update(user)
      .set({ verified: false, updatedAt: new Date() })
      .where(eq(user.id, userId))
    revalidatePath(`/admin/users/${userId}/edit`)
    return { ok: true }
  } catch {
    return { ok: false, error: "Failed to reject" }
  }
}

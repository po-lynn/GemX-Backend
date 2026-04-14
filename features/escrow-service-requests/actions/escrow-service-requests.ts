"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { canManageEscrowRequests } from "@/features/escrow-service-requests/permissions/escrow-service-requests"
import { adminUpdateEscrowStatusSchema } from "@/features/escrow-service-requests/schemas/escrow-service-requests"
import { updateEscrowServiceRequestStatusInDb } from "@/features/escrow-service-requests/db/escrow-service-requests"

export async function updateEscrowServiceRequestStatusAction(
  requestId: string,
  status: string,
  adminNote?: string,
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canManageEscrowRequests(session.user.role)) {
    return { error: "Unauthorized" }
  }

  if (!z.string().uuid().safeParse(requestId).success) {
    return { error: "Invalid request id" }
  }

  const parsed = adminUpdateEscrowStatusSchema.safeParse({ status, adminNote })
  if (!parsed.success) return { error: "Invalid status" }

  const result = await updateEscrowServiceRequestStatusInDb(
    requestId,
    parsed.data.status,
    parsed.data.adminNote,
  )
  if (!result.ok) return { error: "Request not found" }

  revalidatePath("/admin/escrow-service-requests")
  return { success: true, requestId: result.requestId }
}

"use server"

import { revalidatePath } from "next/cache"
import { canAdminManageUsers } from "@/features/users/permissions/users"
import { sendPushToUserIds } from "@/features/push/send-push"
import {
  approveCollectorPieceShowRequestInDb,
  rejectCollectorPieceShowRequestInDb,
} from "@/features/collector-piece-show-requests/db/collector-piece-show-requests"
import { requireActionRole } from "@/lib/action-guard"

export async function approveCollectorPieceShowRequestAction(formData: FormData) {
  const session = await requireActionRole(canAdminManageUsers)
  if (!session) {
    return { error: "Unauthorized" }
  }

  const requestId = String(formData.get("requestId") ?? "").trim()
  if (!requestId) return { error: "Invalid request id" }

  const result = await approveCollectorPieceShowRequestInDb(requestId)
  if (!result.ok) return { error: "Request not found" }

  const link = `/products/${result.productId}`
  sendPushToUserIds([result.userId], {
    title: "Collector piece request approved",
    body: result.productTitle
      ? `${result.productTitle} is approved to be shown.`
      : "Your collector piece request was approved.",
    data: {
      screen: "product",
      productId: result.productId,
      link,
    },
  }).catch((e) => console.error("Collector piece approval push failed:", e))

  revalidatePath("/admin/collector-piece-show-requests")
  return { success: true, requestId: result.requestId, alreadyProcessed: !!result.alreadyProcessed }
}

export async function rejectCollectorPieceShowRequestAction(formData: FormData) {
  const session = await requireActionRole(canAdminManageUsers)
  if (!session) {
    return { error: "Unauthorized" }
  }

  const requestId = String(formData.get("requestId") ?? "").trim()
  if (!requestId) return { error: "Invalid request id" }

  const result = await rejectCollectorPieceShowRequestInDb(requestId)
  if (!result.ok) return { error: "Request not found" }

  revalidatePath("/admin/collector-piece-show-requests")
  return { success: true, requestId: result.requestId, alreadyProcessed: !!result.alreadyProcessed }
}

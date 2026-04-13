"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { canAdminManageUsers } from "@/features/users/permissions/users"
import { sendPushToUserIds } from "@/features/push/send-push"
import { approveCollectorPieceShowRequestInDb } from "@/features/collector-piece-show-requests/db/collector-piece-show-requests"

export async function approveCollectorPieceShowRequestAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canAdminManageUsers(session.user.role)) {
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

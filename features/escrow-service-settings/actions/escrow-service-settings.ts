"use server"

import { canAdminManageUsers } from "@/features/users/permissions/users"
import { getUserById } from "@/features/users/db/users"
import {
  escrowServiceSettingsSchema,
} from "@/features/escrow-service-settings/schemas/escrow-service-settings"
import { saveEscrowServiceSettings } from "@/features/escrow-service-settings/db/escrow-service-settings"
import { zodErrorMessage } from "@/lib/form-data"
import { requireActionRole } from "@/lib/action-guard"

export async function saveEscrowServiceSettingsAction(formData: FormData) {
  const session = await requireActionRole(canAdminManageUsers)
  if (!session) {
    return { error: "Unauthorized" }
  }

  const parsed = escrowServiceSettingsSchema.safeParse({
    userId: formData.get("userId"),
    serviceFee: formData.get("serviceFee"),
    serviceOverview: formData.get("serviceOverview"),
  })
  if (!parsed.success) {
    return {
      error: zodErrorMessage(parsed.error),
    }
  }

  const serviceFee = Number(parsed.data.serviceFee).toFixed(2)
  const selectedUser = await getUserById(parsed.data.userId)
  if (!selectedUser) return { error: "Selected user not found" }

  try {
    await saveEscrowServiceSettings({
      userId: parsed.data.userId,
      serviceFee,
      serviceOverview: parsed.data.serviceOverview?.trim() || "",
    })
    return { success: true }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to save escrow service settings"
    return { error: message }
  }
}


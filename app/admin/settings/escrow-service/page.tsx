import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getAllUsersFromDb } from "@/features/users/db/users"
import { getEscrowServiceSettings } from "@/features/escrow-service-settings/db/escrow-service-settings"
import { EscrowServiceSettingsForm } from "@/features/escrow-service-settings/components/EscrowServiceSettingsForm"
import { FadeUp } from "@/components/admin/motion"

export default async function AdminEscrowServiceSettingsPage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.SETTINGS_ESCROW)

  const settings = await getEscrowServiceSettings()
  const users = await getAllUsersFromDb()

  return (
    <FadeUp>
      <div className="container my-6">
        <EscrowServiceSettingsForm
          settings={settings}
          users={users
            .filter((u) => u.role === "internal")
            .map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
            }))}
        />
      </div>
    </FadeUp>
  )
}


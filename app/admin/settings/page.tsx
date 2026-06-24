import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getAllUsersFromDb } from "@/features/users/db/users"
import { getEscrowServiceSettings } from "@/features/escrow-service-settings/db/escrow-service-settings"
import { getCompanySettings } from "@/features/company-settings/db/company-settings"
import { FadeUp } from "@/components/admin/motion"
import { SettingsPageClient } from "@/features/settings/components/SettingsPageClient"

type Props = {
  searchParams: Promise<{ tab?: string }>
}

export default async function AdminSettingsPage({ searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.SETTINGS_ESCROW)

  const { tab } = await searchParams
  const initialTab = tab === "escrow" ? "escrow" : "company"

  const [companySettings, escrowSettings, allUsers] = await Promise.all([
    getCompanySettings(),
    getEscrowServiceSettings(),
    getAllUsersFromDb({ role: "internal" }),
  ])

  const internalUsers = allUsers
    .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))

  return (
    <FadeUp>
      <div className="container my-6">
        <SettingsPageClient
          initialTab={initialTab}
          companySettings={companySettings}
          escrowSettings={escrowSettings}
          internalUsers={internalUsers}
        />
      </div>
    </FadeUp>
  )
}

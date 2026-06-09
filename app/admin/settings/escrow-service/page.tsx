import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getAllUsersFromDb } from "@/features/users/db/users"
import { getEscrowServiceSettings } from "@/features/escrow-service-settings/db/escrow-service-settings"
import { EscrowServiceSettingsForm } from "@/features/escrow-service-settings/components/EscrowServiceSettingsForm"

export default async function AdminEscrowServiceSettingsPage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.SETTINGS_ESCROW)

  const settings = await getEscrowServiceSettings()
  const users = await getAllUsersFromDb()

  return (
    <div className="container my-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Escrow Service Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure escrow contact profile and service details.
          </p>
        </div>
      </div>

      <EscrowServiceSettingsForm
        settings={settings}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          role: u.role,
        }))}
      />
    </div>
  )
}


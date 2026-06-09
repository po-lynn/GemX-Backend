import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { requireAdmin } from "@/lib/admin-guard"
import { getSupervisorPermissions } from "@/features/rbac/db/permissions"
import { PermissionsForm } from "./PermissionsForm"

export default async function AdminPermissionsPage() {
  await requireAdmin()
  const permissions = await getSupervisorPermissions()

  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <span className="lv-here">Permissions</span>
          </nav>
          <h1 className="lv-h1">Supervisor Permissions</h1>
          <p className="lv-subhead">
            Control which features supervisors can access. Categories and user management are always admin-only.
          </p>
        </div>
      </div>
      <PermissionsForm initial={permissions} />
    </div>
  )
}

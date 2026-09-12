import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { FadeUp } from "@/components/admin/motion"
import { QueueDashboard } from "@/components/admin/queue/QueueDashboard"

export default async function AdminQueuePage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.QUEUE_MANAGEMENT)

  return (
    <FadeUp>
      <div className="py-2">
        <div className="lv-pagehead">
          <div>
            <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
              <Link href="/admin">Admin</Link>
              <ChevronRight />
              <span className="lv-here">Queue</span>
            </nav>
            <h1 className="lv-h1">Queue</h1>
            <p className="lv-subhead">Background job queue health across every feature that uses it.</p>
          </div>
        </div>

        <QueueDashboard />
      </div>
    </FadeUp>
  )
}

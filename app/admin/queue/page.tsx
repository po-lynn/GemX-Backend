import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { connection } from "next/server"
import "@/app/admin-queue-console.css"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { FadeUp } from "@/components/admin/motion"
import { QueueOverview } from "@/components/admin/queue/QueueOverview"

// Feature-access check requires the signed-in session on every load, so this page can never
// be part of a static shell — opt out of Instant Navigation validation like app/admin/layout.tsx.
export const instant = false

export default async function AdminQueuePage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.QUEUE_MANAGEMENT)

  return (
    <FadeUp>
      <div className="py-2">
        <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/admin">Admin</Link>
          <ChevronRight />
          <span className="lv-here">Queue</span>
        </nav>

        <QueueOverview />
      </div>
    </FadeUp>
  )
}

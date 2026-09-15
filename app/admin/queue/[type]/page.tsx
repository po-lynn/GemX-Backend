import { Suspense } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { FadeUp } from "@/components/admin/motion"
import { getQueueJobDefinition } from "@/lib/queue/registry"
import "@/lib/queue/registrations"
import "@/app/admin-queue-console.css"
import { QueueDetail } from "@/components/admin/queue/QueueDetail"

// Feature-access check requires the signed-in session on every load, so this page can never
// be part of a static shell — opt out of Instant Navigation validation like app/admin/layout.tsx.
export const instant = false

type Props = { params: Promise<{ type: string }> }

async function AdminQueueTypeContent({ params }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.QUEUE_MANAGEMENT)

  const { type } = await params
  const definition = getQueueJobDefinition(type)
  if (!definition) notFound()

  return (
    <div className="py-2">
      <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/admin">Admin</Link>
        <ChevronRight />
        <Link href="/admin/queue">Queue</Link>
        <ChevronRight />
        <span className="lv-here">{definition.label}</span>
      </nav>

      <div style={{ marginTop: 8 }}>
        <QueueDetail type={type} />
      </div>
    </div>
  )
}

export default function AdminQueueTypePage(props: Props) {
  return (
    <FadeUp>
      <Suspense
        fallback={
          <div className="animate-pulse space-y-5 py-2">
            <div className="h-8 w-48 rounded-lg bg-slate-200" />
            <div className="h-64 rounded-xl bg-white ring-1 ring-slate-200/60" />
          </div>
        }
      >
        <AdminQueueTypeContent {...props} />
      </Suspense>
    </FadeUp>
  )
}

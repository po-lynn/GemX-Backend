import { Suspense } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { FadeUp } from "@/components/admin/motion"
import { getJob } from "@/lib/queue/queue"
import { getQueueJobDefinition } from "@/lib/queue/registry"
import "@/lib/queue/registrations"
import "@/app/admin-queue-console.css"
import { JobDetailView, type JobDetail } from "@/components/admin/queue/JobDetailView"

type Props = { params: Promise<{ id: string }> }

async function AdminQueueJobContent({ params }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.QUEUE_MANAGEMENT)

  const { id } = await params
  const job = await getJob(id)
  if (!job) notFound()

  const definition = getQueueJobDefinition(job.type)
  const descriptions = definition?.describeJobs ? await definition.describeJobs([job]) : new Map<string, string>()
  const description = descriptions.get(job.id) ?? null
  const label = definition?.label ?? job.type

  const jobDetail: JobDetail = {
    id: job.id,
    type: job.type,
    label,
    status: job.status,
    isStale: job.isStale,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    availableAt: job.availableAt.toISOString(),
    lockedAt: job.lockedAt?.toISOString() ?? null,
    lockedBy: job.lockedBy,
    lastError: job.lastError,
    result: job.result,
    payload: job.payload,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
    description,
  }

  return (
    <div className="py-2">
      <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/admin">Admin</Link>
        <ChevronRight />
        <Link href="/admin/queue">Queue</Link>
        <ChevronRight />
        <Link href={`/admin/queue/${encodeURIComponent(job.type)}`}>{label}</Link>
        <ChevronRight />
        <span className="lv-here">{description ?? job.id}</span>
      </nav>

      <JobDetailView job={jobDetail} />
    </div>
  )
}

export default function AdminQueueJobPage(props: Props) {
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
        <AdminQueueJobContent {...props} />
      </Suspense>
    </FadeUp>
  )
}

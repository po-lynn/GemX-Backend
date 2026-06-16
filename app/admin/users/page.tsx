import Link from "next/link"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getUsersPaginatedFromDb,
  getUserStatsFromDb,
  getViewCountsFromDb,
} from "@/features/users/db/users"
import { getPushTokensByUserIds } from "@/features/push/db/push-tokens"
import { UsersTable } from "@/features/users/components"
import { FadeUp } from "@/components/admin/motion"

const PAGE_SIZE = 20

type Props = {
  searchParams: Promise<{
    page?: string
    search?: string
    view?: string
  }>
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default async function AdminUsersPage({ searchParams }: Props) {
  await connection()
  const session = await requireFeatureAccess(FEATURE_KEYS.USERS)
  const isInternal = session.user.role === "internal"
  const params = await searchParams
  const rawPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const search  = params.search?.trim() ?? ""
  const view    = params.view?.trim() ?? "all"

  const [{ users, total }, stats, viewCounts] = await Promise.all([
    getUsersPaginatedFromDb({ page: rawPage, limit: PAGE_SIZE, search: search || undefined, view, excludeAdminRole: isInternal }),
    getUserStatsFromDb(),
    getViewCountsFromDb(),
  ])

  let pushTokensByUserId: Record<string, { token: string; platform: string | null }[]> = {}
  if (users.length > 0) {
    try {
      pushTokensByUserId = await getPushTokensByUserIds(users.map((u) => u.id))
    } catch (e) {
      console.error("Failed to load push tokens:", e)
    }
  }

  const kpis = [
    {
      label: "Total users",
      value: stats.total.toLocaleString(),
      delta: `+${stats.newThisWeek} new this week`,
      tone: "purple",
    },
    {
      label: "Active",
      value: stats.active.toLocaleString(),
      delta: stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}% of total` : "—",
      tone: "emer",
    },
    {
      label: "KYC verified",
      value: stats.verified.toLocaleString(),
      delta: `${stats.total - stats.verified} awaiting verification`,
      tone: "warn",
    },
    {
      label: "Points in circulation",
      value: fmtCompact(stats.totalPoints),
      delta: `${viewCounts.admins + viewCounts.internals} staff accounts`,
      tone: "purple",
    },
  ]

  return (
    <FadeUp>
    <div className="space-y-5 py-2">
      {/* Page header */}
      <div className="lv-pagehead">
        <div>
          <h1 className="lv-h1">
            Users
            <span className="lv-h1-count">{stats.total.toLocaleString()} total</span>
          </h1>
          <p className="lv-subhead">
            Manage user accounts — roles, KYC, points and access.
          </p>
        </div>
        <div className="lv-pagehead-actions">
          <Button asChild size="sm" className="shrink-0 shadow-sm">
            <Link href="/admin/users/new">
              <Plus className="mr-1.5 size-4" />
              New User
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="lv-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="lv-kpi" data-tone={k.tone}>
            <span className="lv-kpi-label">
              <span className="lv-kpi-dot" />
              {k.label}
            </span>
            <span className="lv-kpi-value">{k.value}</span>
            <span className="lv-kpi-delta">{k.delta}</span>
          </div>
        ))}
      </div>

      <UsersTable
        users={users}
        page={rawPage}
        total={total}
        pageSize={PAGE_SIZE}
        searchQuery={search}
        pushTokensByUserId={pushTokensByUserId}
        view={view}
        viewCounts={viewCounts}
        hideAdminView={isInternal}
      />
    </div>
    </FadeUp>
  )
}

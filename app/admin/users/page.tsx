import Link from "next/link"
import { connection } from "next/server"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getUsersPaginatedFromDb } from "@/features/users/db/users"
import { getPushTokensByUserIds } from "@/features/push/db/push-tokens"
import { UsersTable } from "@/features/users/components"
import { UserFilters } from "@/features/users/components/UserFilters"

const USERS_PAGE_SIZE = 20

type Props = {
  searchParams: Promise<{
    page?: string
    search?: string
    country?: string
    state?: string
    city?: string
  }>
}

export default async function AdminUsersPage({ searchParams }: Props) {
  await connection()
  const params = await searchParams
  const rawPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1)
  const search = params.search?.trim() ?? ""
  const country = params.country?.trim() ?? ""
  const state = params.state?.trim() ?? ""
  const city = params.city?.trim() ?? ""

  const { users, total } = await getUsersPaginatedFromDb({
    page: rawPage,
    limit: USERS_PAGE_SIZE,
    search: search || undefined,
  })

  let pushTokensByUserId: Record<string, { token: string; platform: string | null }[]> = {}
  if (users.length > 0) {
    try {
      pushTokensByUserId = await getPushTokensByUserIds(users.map((u) => u.id))
    } catch (e) {
      console.error("Failed to load push tokens:", e)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE))

  return (
    <div className="space-y-5 py-2">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Users</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage buyer and seller accounts, roles, and points
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0 shadow-sm">
          <Link href="/admin/users/new">
            <Plus className="mr-1.5 size-4" />
            New User
          </Link>
        </Button>
      </div>

      {/* Location filters */}
      <UserFilters country={country} state={state} city={city} />

      {/* Table */}
      <UsersTable
        users={users}
        page={rawPage}
        totalPages={totalPages}
        total={total}
        searchQuery={search}
        pushTokensByUserId={pushTokensByUserId}
      />
    </div>
  )
}

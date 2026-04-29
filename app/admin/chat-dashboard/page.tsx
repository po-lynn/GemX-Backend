import { connection } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { canAdminManageUsers } from "@/features/users/permissions/users"
import { getUsersPaginatedFromDb } from "@/features/users/db/users"
import { ChatDashboard } from "@/features/chat/components/ChatDashboard"

export default async function AdminChatDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ peer?: string }>
}) {
  await connection()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id || !canAdminManageUsers(session.user.role)) {
    return (
      <div className="container my-6">
        <p className="text-sm text-destructive">Unauthorized</p>
      </div>
    )
  }

  const peerFromUrl = (await searchParams)?.peer
  const { users } = await getUsersPaginatedFromDb({ page: 1, limit: 200 })
  const peers = users
    .filter((u) => u.id !== session.user.id)
    .map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      image: u.image ?? null,
    }))

  return (
    <div className="container my-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chat Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Realtime conversation view using Supabase subscriptions.
        </p>
      </div>
      <ChatDashboard
        currentUserId={session.user.id}
        users={peers}
        initialPeerId={
          peerFromUrl && peers.some((p) => p.id === peerFromUrl) ? peerFromUrl : undefined
        }
      />
    </div>
  )
}


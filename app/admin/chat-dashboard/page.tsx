import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getUsersPaginatedFromDb } from "@/features/users/db/users"
import { ChatDashboard } from "@/features/chat/components/ChatDashboard"
import { getLastSessionActivityByUserIds } from "@/features/chat/db/session-presence"
import { getChatPeerProfilesForUser } from "@/features/chat/db/chat-peers"
import { FadeUp } from "@/components/admin/motion"

export default async function AdminChatDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ peer?: string }>
}) {
  await connection()
  const session = await requireFeatureAccess(FEATURE_KEYS.CHAT_DASHBOARD)

  const peerFromUrl = (await searchParams)?.peer
  const [chatPeerRows, { users: directoryRows }] = await Promise.all([
    getChatPeerProfilesForUser(session.user.id),
    getUsersPaginatedFromDb({ page: 1, limit: 200 }),
  ])
  const chatPeerIds = chatPeerRows.map((u) => u.id)
  const activityMap = await getLastSessionActivityByUserIds(chatPeerIds)
  const peers = chatPeerRows.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    image: u.image ?? null,
    lastSessionAt: activityMap.get(u.id)?.toISOString() ?? null,
  }))
  const contactPickerUsers = directoryRows
    .filter((u) => u.id !== session.user.id)
    .map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      image: u.image ?? null,
      lastSessionAt: null as string | null,
    }))

  const peerIdsSet = new Set(peers.map((p) => p.id))
  const initialPeerValid =
    peerFromUrl &&
    (peerIdsSet.has(peerFromUrl) ||
      contactPickerUsers.some((u) => u.id === peerFromUrl))

  return (
    <FadeUp>
      <div className="container my-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chat Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Left panel lists people you already have messages with. Use &ldquo;New chat&rdquo; to message
            anyone else.
          </p>
        </div>
        <ChatDashboard
          currentUserId={session.user.id}
          users={peers}
          contactPickerUsers={contactPickerUsers}
          initialPeerId={initialPeerValid ? peerFromUrl : undefined}
        />
      </div>
    </FadeUp>
  )
}

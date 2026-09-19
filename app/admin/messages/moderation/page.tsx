import { Suspense } from "react"
import { connection } from "next/server"
import { requireChatModerationAccess } from "@/features/chat-moderation/lib/require-chat-moderation-access"
import { ChatModerationDashboard } from "@/features/chat-moderation/components/ChatModerationDashboard"
import { FadeUp } from "@/components/admin/motion"

// Feature-access check requires the signed-in session on every load, so this page can never
// be part of a static shell — opt out of Instant Navigation validation like app/admin/queue/page.tsx.
export const instant = false

export default async function AdminChatModerationPage() {
  await connection()
  await requireChatModerationAccess()

  return (
    <FadeUp className="block h-full">
      <Suspense>
        <ChatModerationDashboard />
      </Suspense>
    </FadeUp>
  )
}

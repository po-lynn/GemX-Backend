import { Suspense } from "react"
import { requireChatModerationAccess } from "@/features/chat-moderation/lib/require-chat-moderation-access"
import { ChatModerationDashboard } from "@/features/chat-moderation/components/ChatModerationDashboard"
import { FadeUp } from "@/components/admin/motion"

export default async function AdminChatModerationPage() {
  await requireChatModerationAccess()

  return (
    <FadeUp className="block h-full">
      <Suspense>
        <ChatModerationDashboard />
      </Suspense>
    </FadeUp>
  )
}

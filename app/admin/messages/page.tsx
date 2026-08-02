import { Suspense } from "react"
import { connection } from "next/server"
import { requireMessagesAccess } from "@/features/messages/lib/require-messages-access"
import { MessagesTriagePage } from "@/features/messages/components/triage/MessagesTriagePage"
import { FadeUp } from "@/components/admin/motion"
import { getTriageConversationsFromDb, getTriageMessagesFromDb } from "@/features/messages/db/triage"

export default async function AdminMessagesPage() {
  await connection()
  await requireMessagesAccess()

  const [conversations, messages] = await Promise.all([
    getTriageConversationsFromDb(),
    getTriageMessagesFromDb(),
  ])

  return (
    <FadeUp className="block h-full">
      <Suspense>
        <MessagesTriagePage initialConversations={conversations} initialMessages={messages} />
      </Suspense>
    </FadeUp>
  )
}

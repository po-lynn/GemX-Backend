import { Suspense } from "react"
import { connection } from "next/server"
import { requireMessagesAccess } from "@/features/messages/lib/require-messages-access"
import { MessagesTriagePage } from "@/features/messages/components/triage/MessagesTriagePage"
import { FadeUp } from "@/components/admin/motion"
import { getTriageConversationsFromDb, getTriageMessagesFromDb } from "@/features/messages/db/triage"
import { withQueryTimeout } from "@/lib/query-timeout"

/** Vercel backstop: if a query hangs past this, the platform kills the render instead of it hanging on the shared connection pool indefinitely. */
export const maxDuration = 10

const ADMIN_MESSAGES_QUERY_TIMEOUT_MS = 6000

export default async function AdminMessagesPage() {
  await connection()
  const session = await requireMessagesAccess()

  // Both primary, sequential (not Promise.all): MessagesTriagePage's "mode" toggle renders
  // either the conversation list or the flat message list as the page's actual content
  // (conversations by default, messages when ?mode=messages) — neither is a decorative
  // enrichment of the other, so both throw on timeout and are caught by error.tsx.
  const conversations = await withQueryTimeout(
    getTriageConversationsFromDb(),
    ADMIN_MESSAGES_QUERY_TIMEOUT_MS,
    "admin-messages-triage-conversations"
  )
  const messages = await withQueryTimeout(
    getTriageMessagesFromDb(),
    ADMIN_MESSAGES_QUERY_TIMEOUT_MS,
    "admin-messages-triage-messages"
  )

  return (
    <FadeUp className="block h-full">
      <Suspense>
        <MessagesTriagePage
          initialConversations={conversations}
          initialMessages={messages}
          currentUserId={session.user.id}
        />
      </Suspense>
    </FadeUp>
  )
}

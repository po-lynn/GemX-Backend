import Link from "next/link"
import { connection } from "next/server"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getAllMessages } from "@/features/messages/db/messages"
import { MessagesTable } from "@/features/messages/components/MessagesTable"

export default async function AdminMessagesPage() {
  await connection()
  const allMessages = await getAllMessages()

  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Messages</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage user chat messages stored in the system
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0 shadow-sm">
          <Link href="/admin/messages/new">
            <Plus className="mr-1.5 size-4" />
            Add Message
          </Link>
        </Button>
      </div>

      <MessagesTable messages={allMessages} />
    </div>
  )
}

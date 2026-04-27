import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAllMessages } from "@/features/messages/db/messages";
import { MessagesTable } from "@/features/messages/components/MessagesTable";

export default async function AdminMessagesPage() {
  await connection();
  const allMessages = await getAllMessages();

  return (
    <div className="container my-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Manage user chat messages stored in the messages table
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/messages/new">
            <Plus className="size-4" />
            Add message
          </Link>
        </Button>
      </div>

      <MessagesTable messages={allMessages} />
    </div>
  );
}


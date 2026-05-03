import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAllMessages } from "@/features/messages/db/messages";
import type { MessageRow } from "@/features/messages/db/messages";
import { MessagesAdminPanel } from "@/features/messages/components/MessagesAdminPanel";

function participantsFromMessages(rows: MessageRow[]) {
  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(r.senderId, r.senderName?.trim() || "Unknown user");
    map.set(r.recipientId, r.recipientName?.trim() || "Unknown user");
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const MESSAGE_ADMIN_PAGE_SIZE = 20;

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function AdminMessagesPage({ searchParams }: PageProps) {
  await connection();
  const params = await searchParams;
  const rawPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const allMessages = await getAllMessages();
  const participants = participantsFromMessages(allMessages);

  return (
    <div className="container my-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Manage user chat messages stored in the messages table
          </p>
        </div>
        <Button asChild className="shrink-0 self-start sm:self-auto">
          <Link href="/admin/messages/new">
            <Plus className="size-4" />
            Add message
          </Link>
        </Button>
      </div>

      <MessagesAdminPanel
        messages={allMessages}
        participants={participants}
        page={rawPage}
        pageSize={MESSAGE_ADMIN_PAGE_SIZE}
      />
    </div>
  );
}

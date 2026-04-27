import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageForm } from "@/features/messages/components/MessageForm";
import { getMessageById } from "@/features/messages/db/messages";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminMessagesEditPage({ params }: Props) {
  await connection();
  const { id } = await params;
  const message = await getMessageById(id);
  if (!message) notFound();

  return (
    <div className="container my-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/messages">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit Message</h1>
          <p className="text-sm text-muted-foreground font-mono">{message.id}</p>
        </div>
      </div>

      <MessageForm mode="edit" message={message} />
    </div>
  );
}


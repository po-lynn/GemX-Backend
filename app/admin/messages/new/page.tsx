import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageForm } from "@/features/messages/components/MessageForm";

export default function AdminMessagesNewPage() {
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
          <h1 className="text-2xl font-semibold tracking-tight">New Message</h1>
          <p className="text-sm text-muted-foreground">
            Create a message row manually in the messages table
          </p>
        </div>
      </div>

      <MessageForm mode="create" />
    </div>
  );
}


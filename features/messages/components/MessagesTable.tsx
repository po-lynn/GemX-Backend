"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { MessageRow } from "@/features/messages/db/messages";
import { deleteMessageAction } from "@/features/messages/actions/messages";
import { Pencil, Trash2 } from "lucide-react";

type Props = {
  messages: MessageRow[];
};

export function MessagesTable({ messages }: Props) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this message?")) return;
    setDeletingId(id);
    const form = new FormData();
    form.set("id", id);
    const result = await deleteMessageAction(form);
    setDeletingId(null);
    if (result?.error) alert(result.error);
    else router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sender</th>
              <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recipient</th>
              <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
              <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Read</th>
              <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</th>
              <th className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-28 px-4 text-center text-muted-foreground">
                  No messages yet.
                </td>
              </tr>
            ) : (
              messages.map((m) => (
                <tr
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/admin/messages/${m.id}/edit`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/admin/messages/${m.id}/edit`);
                    }
                  }}
                  className="cursor-pointer border-b border-border hover:bg-muted/50"
                >
                  <td className="px-4 py-3 font-mono text-xs">{m.senderId}</td>
                  <td className="px-4 py-3 font-mono text-xs">{m.recipientId}</td>
                  <td className="px-4 py-3">{m.messageType}</td>
                  <td className="px-4 py-3">{m.isRead ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{new Date(m.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/admin/messages/${m.id}/edit`}>
                          <Pencil className="size-4" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        disabled={deletingId === m.id}
                        onClick={() => handleDelete(m.id)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


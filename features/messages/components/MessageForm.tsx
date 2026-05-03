"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createMessageAction, updateMessageAction } from "@/features/messages/actions/messages";
import type { MessageRow } from "@/features/messages/db/messages";

type Props = {
  mode: "create" | "edit";
  message?: MessageRow | null;
};

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function MessageForm({ mode, message }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = mode === "edit";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    if (isEdit && message) form.set("id", message.id);
    const result = isEdit ? await updateMessageAction(form) : await createMessageAction(form);
    setLoading(false);
    if (result?.error) return setError(result.error);
    router.push("/admin/messages");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-6">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="senderId">Sender Name</label>
          <input
            id="senderId"
            name="senderId"
            className={inputClass}
            defaultValue={message?.senderName ?? ""}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="recipientId">Recipient Name</label>
          <input
            id="recipientId"
            name="recipientId"
            className={inputClass}
            defaultValue={message?.recipientName ?? ""}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="content">Content</label>
          <textarea
            id="content"
            name="content"
            className="min-h-28 w-full rounded-md border border-input bg-transparent p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            defaultValue={message?.content ?? ""}
            maxLength={5000}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="fileUrl">File URL</label>
          <input
            id="fileUrl"
            name="fileUrl"
            className={inputClass}
            placeholder="https://..."
            defaultValue={message?.fileUrl ?? ""}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="messageType">Message Type</label>
          <select
            id="messageType"
            name="messageType"
            className={inputClass}
            defaultValue={message?.messageType ?? "text"}
          >
            <option value="text">text</option>
            <option value="image">image</option>
            <option value="audio">audio</option>
            <option value="file">file</option>
          </select>
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isRead"
            defaultChecked={message?.isRead ?? false}
          />
          Read
        </label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : isEdit ? "Update" : "Create"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/messages">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}


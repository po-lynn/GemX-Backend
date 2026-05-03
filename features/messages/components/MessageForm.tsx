"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AdminFormSection,
  AdminFormError,
  adminInput,
  adminSelect,
  adminTextarea,
  adminLabel,
  adminFieldClass,
} from "@/components/admin/admin-ui";
import { createMessageAction, updateMessageAction } from "@/features/messages/actions/messages";
import type { MessageRow } from "@/features/messages/db/messages";

type Props = {
  mode: "create" | "edit";
  message?: MessageRow | null;
};

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
    <div className="max-w-2xl space-y-5">
      <form onSubmit={handleSubmit}>
        <AdminFormSection
          title={isEdit ? "Edit message" : "New message"}
          description={isEdit ? "Update message details" : "Create a message row in the messages table"}
        >
          <div className="space-y-4">
            <div className={adminFieldClass}>
              <label className={adminLabel} htmlFor="senderId">Sender ID</label>
              <input id="senderId" name="senderId" required
                className={adminInput} defaultValue={message?.senderId ?? ""} />
            </div>

            <div className={adminFieldClass}>
              <label className={adminLabel} htmlFor="recipientId">Recipient ID</label>
              <input id="recipientId" name="recipientId" required
                className={adminInput} defaultValue={message?.recipientId ?? ""} />
            </div>

            <div className={adminFieldClass}>
              <label className={adminLabel} htmlFor="content">Content</label>
              <textarea id="content" name="content" rows={4} required maxLength={5000}
                className={adminTextarea} defaultValue={message?.content ?? ""} />
            </div>

            <div className={adminFieldClass}>
              <label className={adminLabel} htmlFor="fileUrl">File URL</label>
              <input id="fileUrl" name="fileUrl" placeholder="https://…"
                className={adminInput} defaultValue={message?.fileUrl ?? ""} />
            </div>

            <div className={adminFieldClass}>
              <label className={adminLabel} htmlFor="messageType">Message type</label>
              <select id="messageType" name="messageType" className={adminSelect}
                defaultValue={message?.messageType ?? "text"}>
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="audio">Audio</option>
                <option value="file">File</option>
              </select>
            </div>

            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="isRead" defaultChecked={message?.isRead ?? false}
                className="h-4 w-4 rounded border-slate-200 accent-violet-600" />
              Mark as read
            </label>
          </div>
        </AdminFormSection>

        <AdminFormError error={error} />

        <div className="mt-5 flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/messages">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

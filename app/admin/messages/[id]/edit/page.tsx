import { connection } from "next/server";
import { notFound } from "next/navigation";
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
    <div className="space-y-5 py-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Edit Message</h1>
        <p className="mt-0.5 font-mono text-sm text-slate-500">{message.id}</p>
      </div>
      <MessageForm mode="edit" message={message} />
    </div>
  );
}

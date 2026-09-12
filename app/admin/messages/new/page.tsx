import { requireFeatureAccess } from "@/lib/admin-guard";
import { FEATURE_KEYS } from "@/features/rbac/feature-keys";
import { MessageForm } from "@/features/messages/components/MessageForm";
import { FadeUp } from "@/components/admin/motion";

export default async function AdminMessagesNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.MESSAGES);
  return (
    <FadeUp>
      <div className="space-y-5 py-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">New Message</h1>
          <p className="mt-0.5 text-sm text-slate-500">Create a message row manually in the messages table</p>
        </div>
        <MessageForm mode="create" />
      </div>
    </FadeUp>
  );
}

import { requireAdmin } from "@/lib/admin-guard";
import { UserForm } from "@/features/users/components";
import { FadeUp } from "@/components/admin/motion";

export default async function AdminUsersNewPage() {
  await requireAdmin();
  return <FadeUp><UserForm key="create" mode="create" /></FadeUp>;
}

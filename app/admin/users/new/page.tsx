import { requireAdmin } from "@/lib/admin-guard";
import { UserForm } from "@/features/users/components";

export default async function AdminUsersNewPage() {
  await requireAdmin();
  return <UserForm key="create" mode="create" />;
}

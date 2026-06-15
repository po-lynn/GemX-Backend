import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { UserForm } from "@/features/users/components";
import { getUserById } from "@/features/users/db/users";
import { getUserPermissions } from "@/features/rbac/db/permissions";
import { requireAdmin } from "@/lib/admin-guard";
import { FadeUp } from "@/components/admin/motion";

type Props = {
  params: Promise<{ id: string }>;
};

async function AdminUsersEditContent({ params }: Props) {
  await connection();
  await requireAdmin();
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  const permissions = user.role === "internal" ? await getUserPermissions(user.id) : {};

  return <UserForm key={user.id} mode="edit" user={user} permissions={permissions} />;
}

export default function AdminUsersEditPage(props: Props) {
  return (
    <FadeUp>
      <Suspense
        fallback={
          <div className="animate-pulse space-y-5 py-2">
            <div className="h-8 w-48 rounded-lg bg-slate-200" />
            <div className="h-96 rounded-xl bg-white ring-1 ring-slate-200/60" />
          </div>
        }
      >
        <AdminUsersEditContent {...props} />
      </Suspense>
    </FadeUp>
  );
}

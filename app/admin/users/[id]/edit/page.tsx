import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { UserForm } from "@/features/users/components";
import { KycDocumentsCard } from "@/features/users/components/KycDocumentsCard";
import { getUserById } from "@/features/users/db/users";
import { getUserPermissions } from "@/features/rbac/db/permissions";
import { requireFeatureAccess } from "@/lib/admin-guard";
import { FEATURE_KEYS } from "@/features/rbac/feature-keys";
import { FadeUp } from "@/components/admin/motion";
import { resolveAdjacentUsers } from "./resolve-adjacent";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; search?: string; view?: string }>;
};

async function AdminUsersEditContent({ params, searchParams }: Props) {
  await connection();
  const session = await requireFeatureAccess(FEATURE_KEYS.USERS);
  const isInternal = session.user.role === "internal";
  const { id } = await params;
  const sp = await searchParams;
  const user = await getUserById(id);
  if (!user) notFound();

  // Internal users cannot view or edit admin accounts.
  if (isInternal && user.role === "admin") redirect("/admin/users");

  const [permissions, adjacent] = await Promise.all([
    user.role === "internal" ? getUserPermissions(user.id) : Promise.resolve({}),
    resolveAdjacentUsers(id, { page: sp.page, search: sp.search, view: sp.view }),
  ]);

  return (
    <div className="space-y-6">
      <UserForm
        key={user.id}
        mode="edit"
        user={user}
        permissions={permissions}
        canAssignAdmin={!isInternal}
        prevHref={adjacent.prevHref}
        nextHref={adjacent.nextHref}
        listPosition={adjacent.position}
        listTotal={adjacent.total}
      />
      <KycDocumentsCard userId={user.id} user={user} />
    </div>
  );
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

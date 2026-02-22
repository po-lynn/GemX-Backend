import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";
import { UserForm } from "@/features/users/components";
import { getUserById } from "@/features/users/db/users";
import { ChevronLeft } from "lucide-react";

type Props = {
  params: Promise<{ id: string }>;
};

async function AdminUsersEditContent({ params }: Props) {
  await connection();
  const { id } = await params;
  const user = await getUserById(id);

  if (!user) notFound();

  return (
    <div className="container my-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/users">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit User</h1>
          <p className="text-muted-foreground text-sm">{user.name}</p>
        </div>
      </div>

      <UserForm key={user.id} mode="edit" user={user} />
    </div>
  );
}

export default function AdminUsersEditPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="container my-6 animate-pulse space-y-4 rounded-lg bg-muted/30 p-6">
          Loading...
        </div>
      }
    >
      <AdminUsersEditContent {...props} />
    </Suspense>
  );
}

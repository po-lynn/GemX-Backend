import Link from "next/link";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAllUsersFromDb } from "@/features/users/db/users";
import { UsersTable } from "@/features/users/components";
import { ChevronLeft, Plus } from "lucide-react";

export default async function AdminUsersPage() {
  await connection();
  const users = await getAllUsersFromDb();

  return (
    <div className="container my-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin">
              <ChevronLeft className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
            <p className="text-muted-foreground text-sm">
              Manage user accounts and roles
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/admin/users/new">
            <Plus className="mr-2 size-4" />
            New User
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Create, edit, or remove user accounts. Only admins can access this.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No users yet.
            </p>
          ) : (
            <UsersTable users={users} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

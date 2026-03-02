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
import { getUsersPaginatedFromDb } from "@/features/users/db/users";
import { UserFilters, UsersTable } from "@/features/users/components";
import { ChevronLeft, Plus } from "lucide-react";

const USERS_PAGE_SIZE = 20;

type Props = {
  searchParams: Promise<{ page?: string; country?: string; state?: string; city?: string }>;
};

export default async function AdminUsersPage({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  const rawPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const country = params.country ?? "";
  const state = params.state ?? "";
  const city = params.city ?? "";
  const { users, total } = await getUsersPaginatedFromDb({
    page: rawPage,
    limit: USERS_PAGE_SIZE,
    country: country || undefined,
    state: state || undefined,
    city: city || undefined,
  });
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const filters = { country, state, city };

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

      <Card className="bg-transparent border-0 shadow-none">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
          {total} user{total !== 1 ? "s" : ""} total
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UserFilters country={country} state={state} city={city} />
          <UsersTable
            users={users}
            page={rawPage}
            totalPages={totalPages}
            total={total}
            filters={filters}
          />
        </CardContent>
      </Card>
    </div>
  );
}

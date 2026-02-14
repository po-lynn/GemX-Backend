import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserForm } from "@/features/users/components";
import { ChevronLeft } from "lucide-react";

export default function AdminUsersNewPage() {
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
          <h1 className="text-2xl font-semibold tracking-tight">New User</h1>
          <p className="text-muted-foreground text-sm">
            Create a user with email and password
          </p>
        </div>
      </div>

      <UserForm key="create" mode="create" />
    </div>
  );
}

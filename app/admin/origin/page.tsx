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
import { getCachedOrigins } from "@/features/origin/db/cache/origin";
import { OriginTable } from "@/features/origin/components";
import { ChevronLeft, Plus } from "lucide-react";

export default async function AdminOriginPage() {
  await connection();
  const origins = await getCachedOrigins();

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
            <h1 className="text-2xl font-semibold tracking-tight">Origin</h1>
            <p className="text-muted-foreground text-sm">
              Manage gem origins (e.g. Myanmar, Sri Lanka)
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/admin/origin/new">
            <Plus className="mr-2 size-4" />
            New Origin
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Origins</CardTitle>
          <CardDescription>
            Add or edit origins used for product sourcing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {origins.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No origins yet. Create one to get started.
            </p>
          ) : (
            <OriginTable origins={origins} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

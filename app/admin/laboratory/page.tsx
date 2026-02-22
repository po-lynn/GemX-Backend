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
import { getCachedLaboratories } from "@/features/laboratory/db/cache/laboratory";
import { LaboratoryTable } from "@/features/laboratory/components";
import { ChevronLeft, Plus } from "lucide-react";

export default async function AdminLaboratoryPage() {
  await connection();
  const laboratories = await getCachedLaboratories();

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
            <h1 className="text-2xl font-semibold tracking-tight">
              Laboratory
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage certification laboratories (e.g. GIA, AGS)
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/admin/laboratory/new">
            <Plus className="mr-2 size-4" />
            New Laboratory
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Laboratories</CardTitle>
          <CardDescription>
            Add or edit laboratories used for product certifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {laboratories.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No laboratories yet. Create one to get started.
            </p>
          ) : (
            <LaboratoryTable laboratories={laboratories} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

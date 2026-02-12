import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LaboratoryForm } from "@/features/laboratory/components";
import { getCachedLaboratoryById } from "@/features/laboratory/db/cache/laboratory";
import { ChevronLeft } from "lucide-react";

type Props = {
  params: Promise<{ id: string }>;
};

async function AdminLaboratoryEditContent({ params }: Props) {
  const { id } = await params;
  const laboratory = await getCachedLaboratoryById(id);

  if (!laboratory) notFound();

  return (
    <div className="container my-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/laboratory">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit Laboratory
          </h1>
          <p className="text-muted-foreground text-sm">
            Update {laboratory.name}
          </p>
        </div>
      </div>

      <LaboratoryForm mode="edit" laboratory={laboratory} />
    </div>
  );
}

export default function AdminLaboratoryEditPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="container my-6 animate-pulse space-y-4 rounded-lg bg-muted/30 p-6">
          Loading...
        </div>
      }
    >
      <AdminLaboratoryEditContent {...props} />
    </Suspense>
  );
}

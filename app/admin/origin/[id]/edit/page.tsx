import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";
import { OriginForm } from "@/features/origin/components";
import { getCachedOriginById } from "@/features/origin/db/cache/origin";
import { ChevronLeft } from "lucide-react";

type Props = {
  params: Promise<{ id: string }>;
};

async function AdminOriginEditContent({ params }: Props) {
  await connection();
  const { id } = await params;
  const origin = await getCachedOriginById(id);

  if (!origin) notFound();

  return (
    <div className="container my-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/origin">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit Origin
          </h1>
          <p className="text-muted-foreground text-sm">
            Update {origin.name}
          </p>
        </div>
      </div>

      <OriginForm key={origin.id} mode="edit" origin={origin} />
    </div>
  );
}

export default function AdminOriginEditPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="container my-6 animate-pulse space-y-4 rounded-lg bg-muted/30 p-6">
          Loading...
        </div>
      }
    >
      <AdminOriginEditContent {...props} />
    </Suspense>
  );
}

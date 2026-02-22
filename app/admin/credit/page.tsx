import Link from "next/link";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";
import { getPointManagementSettings } from "@/features/points/db/points";
import { PointManagementForm } from "@/features/points/components/PointManagementForm";
import { ChevronLeft } from "lucide-react";

export default async function AdminCreditPage() {
  await connection();
  const settings = await getPointManagementSettings();

  return (
    <div className="container my-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Point Management
          </h1>
          <p className="text-muted-foreground text-sm">
            Configure user points and currency conversion.
          </p>
        </div>
      </div>

      <PointManagementForm settings={settings} />
    </div>
  );
}

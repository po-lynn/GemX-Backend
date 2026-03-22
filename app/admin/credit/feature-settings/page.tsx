import Link from "next/link";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";
import { getFeatureSettings } from "@/features/points/db/points";
import { FeatureSettingsForm } from "@/features/points/components/FeatureSettingsForm";
import { ChevronLeft } from "lucide-react";

export default async function AdminFeatureSettingsPage() {
  await connection();
  const settings = await getFeatureSettings();

  return (
    <div className="container my-6 max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/credit">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back to Point Management</span>
          </Link>
        </Button>
      </div>
      <FeatureSettingsForm settings={settings} />
    </div>
  );
}

import Link from "next/link";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";
import { getEscrowServiceSettings } from "@/features/points/db/points";
import { EscrowServiceSettingsForm } from "@/features/points/components/EscrowServiceSettingsForm";
import { ChevronLeft } from "lucide-react";

export default async function AdminEscrowServiceSettingsPage() {
  await connection();
  const settings = await getEscrowServiceSettings();

  return (
    <div className="container my-6 max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/credit/feature-settings">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back to Feature Settings</span>
          </Link>
        </Button>
      </div>
      <EscrowServiceSettingsForm settings={settings} />
    </div>
  );
}

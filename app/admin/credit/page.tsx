import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getDefaultRegistrationPoints,
  getEarningPointsRates,
} from "@/features/points/db/points";
import { PointsSettingsForm } from "@/features/points/components/PointsSettingsForm";
import { ChevronLeft } from "lucide-react";

export default async function AdminCreditPage() {
  const [defaultPoints, earningRates] = await Promise.all([
    getDefaultRegistrationPoints(),
    getEarningPointsRates(),
  ]);

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
          <h1 className="text-2xl font-semibold tracking-tight">Credit / Points</h1>
          <p className="text-muted-foreground text-sm">
            Configure default points for new users and manage point settings
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Points settings</CardTitle>
          <CardDescription>
            Set default points for new users, the earning rate (points per unit),
            and manage point settings. Change individual user points from the Users page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PointsSettingsForm
            defaultRegistrationPoints={defaultPoints}
            earningPointsRates={earningRates}
          />
        </CardContent>
      </Card>
    </div>
  );
}

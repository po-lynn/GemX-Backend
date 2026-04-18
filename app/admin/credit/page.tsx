import { connection } from "next/server";
import { getPointManagementSettings, getPointPurchasePackagesSettings } from "@/features/points/db/points";
import { CreditSettingsForm } from "@/features/points/components/CreditSettingsForm";

export default async function AdminCreditPage() {
  await connection();
  const management = await getPointManagementSettings();
  const packages = await getPointPurchasePackagesSettings();

  
  return (
    <div className="container my-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Point Packages</h1>
        <p className="text-muted-foreground text-sm">
          Configure default points for new users, payment methods, and purchasable packages.
        </p>
      </div>
      <CreditSettingsForm
        defaultRegistrationPoints={management.defaultRegistrationPoints}
        paymentMethods={management.paymentMethods}
        packages={packages.packages}
      />
    </div>
  );
}

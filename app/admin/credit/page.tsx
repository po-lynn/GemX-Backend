import { connection } from "next/server";
import { getPointManagementSettings, getPointPurchasePackagesSettings } from "@/features/points/db/points";
import { CreditSettingsForm } from "@/features/points/components/CreditSettingsForm";

export default async function AdminCreditPage() {
  await connection();
  const management = await getPointManagementSettings();
  const packages = await getPointPurchasePackagesSettings();

  
  return (
    <div className="container my-6 max-w-7xl">
      <CreditSettingsForm
        defaultRegistrationPoints={management.defaultRegistrationPoints}
        paymentMethods={management.paymentMethods}
        packages={packages.packages}
      />
    </div>
  );
}

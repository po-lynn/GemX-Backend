import { connection } from "next/server";
import { requireFeatureAccess } from "@/lib/admin-guard";
import { FEATURE_KEYS } from "@/features/rbac/feature-keys";
import {
  getPointManagementSettings,
  getPointPurchasePackagesSettings,
  getFeatureSettings,
  getPremiumDealersSettings,
} from "@/features/points/db/points";
import { CreditSettingsForm } from "@/features/points/components/CreditSettingsForm";

export default async function AdminCreditPage() {
  await connection();
  await requireFeatureAccess(FEATURE_KEYS.CREDIT_PACKAGES);
  const [management, packages, featureSettings, dealerSettings] =
    await Promise.all([
      getPointManagementSettings(),
      getPointPurchasePackagesSettings(),
      getFeatureSettings(),
      getPremiumDealersSettings(),
    ]);

  return (
    <div className="container my-6 max-w-7xl">
      <CreditSettingsForm
        defaultRegistrationPoints={management.defaultRegistrationPoints}
        paymentMethods={management.paymentMethods}
        packages={packages.packages}
        featureSettings={featureSettings}
        dealerPackages={dealerSettings.packages}
      />
    </div>
  );
}

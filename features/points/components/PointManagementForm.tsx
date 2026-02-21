"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { savePointManagementSettingsAction } from "@/features/points/actions/points";
import type { PointManagementSettings } from "@/features/points/db/points";
import { Gift, Coins, Settings } from "lucide-react";

const inputClass =
  "flex h-9 rounded-md border border-input bg-transparent px-2 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";
const inputClassFull = inputClass + " w-full";

const CURRENCIES = [
  { value: "mmk", label: "MMK" },
  { value: "usd", label: "USD" },
  { value: "krw", label: "KRW" },
] as const;

const ROUNDING_OPTIONS = [
  { value: "down", label: "Round Down" },
  { value: "up", label: "Round Up" },
  { value: "nearest", label: "Round to Nearest" },
] as const;

type Props = {
  settings: PointManagementSettings;
  formId?: string;
};

export function PointManagementForm({ settings, formId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await savePointManagementSettingsAction(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  function handleReset() {
    window.location.reload();
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Left column */}
        <div className="space-y-6 min-w-0">
          {/* Registration Bonus */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gift className="size-5 text-muted-foreground" />
                <CardTitle>Registration Bonus</CardTitle>
              </div>
              <CardDescription>
                Points given when a user registers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="registrationBonusEnabled" className="text-sm font-medium">
                  Enable Registration Bonus
                </label>
                <input
                  type="hidden"
                  name="registrationBonusEnabled"
                  value="off"
                />
                <input
                  id="registrationBonusEnabled"
                  name="registrationBonusEnabled"
                  type="checkbox"
                  value="on"
                  defaultChecked={settings.registrationBonusEnabled}
                  className="size-4 rounded border-input"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="defaultRegistrationPoints" className="text-sm font-medium">
                  Default Points for New User
                </label>
                <input
                  id="defaultRegistrationPoints"
                  name="defaultRegistrationPoints"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={settings.defaultRegistrationPoints}
                  className={inputClassFull}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="registrationBonusDescription" className="text-sm font-medium">
                  Bonus Description
                </label>
                <input
                  id="registrationBonusDescription"
                  name="registrationBonusDescription"
                  type="text"
                  defaultValue={settings.registrationBonusDescription}
                  className={inputClassFull}
                  placeholder="Welcome bonus"
                />
              </div>
            </CardContent>
          </Card>

          {/* Currency Conversion Rates */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Coins className="size-5 text-muted-foreground" />
                <CardTitle>Currency Conversion Rates</CardTitle>
              </div>
              <CardDescription>
                Define how much spending earns points.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 min-w-0 overflow-hidden">
              {/* MMK - one row: two inputs and = only */}
              <div className="flex flex-nowrap items-center gap-2 rounded-lg border p-3 min-w-0">
                <span className="text-sm font-medium shrink-0 w-9">MMK</span>
                <input
                  name="earningMmkAmount"
                  type="number"
                  min={1}
                  defaultValue={settings.currencyConversion.mmk.amount}
                  className={inputClass + " w-16 min-w-0 shrink-0"}
                  aria-label="Amount"
                />
                <span className="text-sm text-muted-foreground shrink-0">=</span>
                <input
                  name="earningMmkPoints"
                  type="number"
                  min={0}
                  defaultValue={settings.currencyConversion.mmk.points}
                  className={inputClass + " w-14 min-w-0 shrink-0"}
                  aria-label="Points"
                />
                <span className="text-sm text-muted-foreground shrink-0">Point(s)</span>
              </div>
              {/* USD */}
              <div className="flex flex-nowrap items-center gap-2 rounded-lg border p-3 min-w-0">
                <span className="text-sm font-medium shrink-0 w-9">USD</span>
                <input
                  name="earningUsdAmount"
                  type="number"
                  min={1}
                  defaultValue={settings.currencyConversion.usd.amount}
                  className={inputClass + " w-16 min-w-0 shrink-0"}
                  aria-label="Amount"
                />
                <span className="text-sm text-muted-foreground shrink-0">=</span>
                <input
                  name="earningUsdPoints"
                  type="number"
                  min={0}
                  defaultValue={settings.currencyConversion.usd.points}
                  className={inputClass + " w-14 min-w-0 shrink-0"}
                  aria-label="Points"
                />
                <span className="text-sm text-muted-foreground shrink-0">Points</span>
              </div>
              {/* KRW */}
              <div className="flex flex-nowrap items-center gap-2 rounded-lg border p-3 min-w-0">
                <span className="text-sm font-medium shrink-0 w-9">KRW</span>
                <input
                  name="earningKrwAmount"
                  type="number"
                  min={1}
                  defaultValue={settings.currencyConversion.krw.amount}
                  className={inputClass + " w-16 min-w-0 shrink-0"}
                  aria-label="Amount"
                />
                <span className="text-sm text-muted-foreground shrink-0">=</span>
                <input
                  name="earningKrwPoints"
                  type="number"
                  min={0}
                  defaultValue={settings.currencyConversion.krw.points}
                  className={inputClass + " w-14 min-w-0 shrink-0"}
                  aria-label="Points"
                />
                <span className="text-sm text-muted-foreground shrink-0">Points</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Point Rules */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="size-5 text-muted-foreground" />
                <CardTitle>Point Rules</CardTitle>
              </div>
              <CardDescription>
                Minimum spend to earn points, rounding, and expiry.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="minimumSpendAmount" className="text-sm font-medium">
                  Minimum Spend to Earn Points
                </label>
                <div className="flex gap-2">
                  <input
                    id="minimumSpendAmount"
                    name="minimumSpendAmount"
                    type="number"
                    min={0}
                    defaultValue={settings.minimumSpendAmount}
                    className={inputClassFull}
                  />
                  <select
                    name="minimumSpendCurrency"
                    className={inputClass + " w-24"}
                    defaultValue={settings.minimumSpendCurrency}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="roundingMethod" className="text-sm font-medium">
                  Rounding Method
                </label>
                <select
                  id="roundingMethod"
                  name="roundingMethod"
                  className={inputClassFull}
                  defaultValue={settings.roundingMethod}
                >
                  {ROUNDING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="pointExpiryDays" className="text-sm font-medium">
                  Point Expiry
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="pointExpiryDays"
                    name="pointExpiryDays"
                    type="number"
                    min={0}
                    defaultValue={settings.pointExpiryDays}
                    className={inputClass + " w-24"}
                  />
                  <span className="text-sm text-muted-foreground">Days</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
        <Button type="button" variant="outline" onClick={handleReset} disabled={loading}>
          Reset
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save Point Settings"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { savePointsSettingsAction } from "@/features/points/actions/points";

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

type EarningRates = { mmk: number; usd: number; krw: number };

type Props = {
  defaultRegistrationPoints: number;
  earningPointsRates: EarningRates;
};

export function PointsSettingsForm({
  defaultRegistrationPoints,
  earningPointsRates,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await savePointsSettingsAction(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div className="space-y-2">
        <label htmlFor="defaultRegistrationPoints" className="text-sm font-medium">
          Default points on registration
        </label>
        <input
          id="defaultRegistrationPoints"
          name="defaultRegistrationPoints"
          type="number"
          min={0}
          step={1}
          defaultValue={defaultRegistrationPoints}
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground">
          New users will receive this many points when they sign up (admin-created
          or mobile registration).
        </p>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium">Earning points rate per currency</p>
        <p className="text-xs text-muted-foreground">
          Points earned per 1 unit of each currency when awarding points for transactions.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="earningPointsRateMmk" className="text-sm font-medium">
              MMK (Kyat)
            </label>
            <input
              id="earningPointsRateMmk"
              name="earningPointsRateMmk"
              type="number"
              min={0}
              step={1}
              defaultValue={earningPointsRates.mmk}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="earningPointsRateUsd" className="text-sm font-medium">
              USD
            </label>
            <input
              id="earningPointsRateUsd"
              name="earningPointsRateUsd"
              type="number"
              min={0}
              step={1}
              defaultValue={earningPointsRates.usd}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="earningPointsRateKrw" className="text-sm font-medium">
              KRW (Won)
            </label>
            <input
              id="earningPointsRateKrw"
              name="earningPointsRateKrw"
              type="number"
              min={0}
              step={1}
              defaultValue={earningPointsRates.krw}
              className={inputClass}
            />
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

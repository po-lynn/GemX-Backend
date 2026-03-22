"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { saveFeatureSettingsAction } from "@/features/points/actions/points";
import type { FeaturePricingTier, FeatureSettings } from "@/features/points/db/points";
import { Check, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const accent = "#9B5CFF";

const DURATIONS: { days: number; label: string }[] = [
  { days: 1, label: "1 Day" },
  { days: 3, label: "3 Days" },
  { days: 7, label: "7 Days" },
  { days: 14, label: "14 Days" },
  { days: 30, label: "30 Days" },
];

const inputClass =
  "h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B5CFF]/40";

type Props = {
  settings: FeatureSettings;
};

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: accent }}
      >
        <Check className="h-4 w-4 stroke-[3]" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export function FeatureSettingsForm({ settings }: Props) {
  const router = useRouter();
  const [tiers, setTiers] = useState<FeaturePricingTier[]>(() => [...settings.pricingTiers]);
  const [limit, setLimit] = useState(settings.homeFeaturedLimit);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set("homeFeaturedLimit", String(limit));
    fd.set("pricingTiersJson", JSON.stringify(tiers));
    const result = await saveFeatureSettingsAction(fd);
    if (result?.error) setError(result.error);
    else router.refresh();
    setLoading(false);
  }

  function updateTier(i: number, patch: Partial<FeaturePricingTier>) {
    setTiers((prev) => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  }

  function removeTier(i: number) {
    setTiers((prev) => prev.filter((_, j) => j !== i));
  }

  function addTier() {
    setTiers((prev) => [...prev, { durationDays: 1, points: 0, badge: undefined }]);
  }

  return (
    <form id="feature-settings-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Feature Settings</h1>
        <Button
          type="submit"
          form="feature-settings-form"
          disabled={loading}
          className="rounded-lg px-5 font-medium text-white shadow-sm"
          style={{ backgroundColor: accent }}
        >
          {loading ? "Saving…" : "Save Settings"}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionHeader
          title="Pricing & Duration"
          description="Set the pricing and duration for featuring products using points."
        />
        {/* One row per tier: Duration | Points | Badge | delete */}
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[18rem] sm:min-w-0">
            <div
              className="grid grid-cols-[minmax(0,1.2fr)_5.5rem_minmax(0,1fr)_2.25rem] items-center gap-2 border-b border-slate-100 pb-2 text-xs font-medium uppercase tracking-wide text-slate-400"
              role="row"
            >
              <span className="min-w-0">Duration</span>
              <span className="text-center">Points</span>
              <span className="min-w-0">Badge</span>
              <span className="sr-only">Remove</span>
            </div>
            <div className="divide-y divide-slate-100">
              {tiers.map((tier, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[minmax(0,1.2fr)_5.5rem_minmax(0,1fr)_2.25rem] items-center gap-2 py-2"
                  role="row"
                >
                  <select
                    className={cn(inputClass, "min-w-0 w-full")}
                    value={tier.durationDays}
                    onChange={(e) => updateTier(i, { durationDays: Number(e.target.value) })}
                  >
                    {!DURATIONS.some((d) => d.days === tier.durationDays) ? (
                      <option value={tier.durationDays}>{tier.durationDays} Days</option>
                    ) : null}
                    {DURATIONS.map((d) => (
                      <option key={d.days} value={d.days}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    className={cn(inputClass, "w-full min-w-0 text-center tabular-nums")}
                    value={tier.points}
                    onChange={(e) =>
                      updateTier(i, { points: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                    }
                  />
                  <input
                    type="text"
                    className={cn(inputClass, "min-w-0 w-full")}
                    placeholder="Optional"
                    value={tier.badge ?? ""}
                    onChange={(e) =>
                      updateTier(i, {
                        badge: e.target.value.trim() ? e.target.value.slice(0, 50) : undefined,
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => removeTier(i)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center justify-self-end rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Remove tier"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={addTier}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          style={{ color: accent, backgroundColor: `${accent}18` }}
        >
          <Plus className="h-4 w-4" />
          Add Option
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <SectionHeader
          title="Feature Product Limit"
          description="Set the maximum number of featured products allowed on the homepage at one time."
        />
        <div className="mt-4 flex max-w-xs items-stretch rounded-md border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            className="flex w-10 items-center justify-center border-r border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={() => setLimit((n) => Math.max(1, n - 1))}
            aria-label="Decrease"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={100}
            className="h-10 w-full min-w-0 border-0 bg-transparent text-center text-sm font-medium text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9B5CFF]/40"
            value={limit}
            onChange={(e) =>
              setLimit(Math.min(100, Math.max(1, Math.floor(Number(e.target.value) || 1))))
            }
          />
          <button
            type="button"
            className="flex w-10 items-center justify-center border-l border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={() => setLimit((n) => Math.min(100, n + 1))}
            aria-label="Increase"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex justify-center pt-1">
        <Button
          type="submit"
          disabled={loading}
          size="lg"
          className="min-w-[200px] rounded-lg px-8 font-medium text-white"
          style={{ backgroundColor: accent }}
        >
          {loading ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { savePremiumDealersSettingsAction } from "@/features/points/actions/points";
import type { PremiumDealerPackage } from "@/features/points/db/points";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const accent = "#9B5CFF";

const inputClass =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B5CFF]/40";

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

type Props = {
  settings: { packages: PremiumDealerPackage[] };
};

export function PremiumDealersSettingsForm({ settings }: Props) {
  const router = useRouter();
  const [packages, setPackages] = useState<PremiumDealerPackage[]>(() =>
    settings.packages.map((p) => ({ ...p }))
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set("packagesJson", JSON.stringify(packages));
    const result = await savePremiumDealersSettingsAction(fd);
    if (result?.error) setError(result.error);
    else router.refresh();
    setLoading(false);
  }

  function updatePkg(i: number, patch: Partial<PremiumDealerPackage>) {
    setPackages((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  function removePkg(i: number) {
    setPackages((prev) => prev.filter((_, j) => j !== i));
  }

  function addPkg() {
    setPackages((prev) => [
      ...prev,
      {
        name: "New Package",
        pointsRequired: 0,
        serviceFeePercent: 0,
        transactionLimitUsd: 0,
      },
    ]);
  }

  return (
    <form id="premium-dealers-settings-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Premium Dealers Package Settings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure premium dealers packages with points.
          </p>
        </div>
        <Button
          type="submit"
          form="premium-dealers-settings-form"
          disabled={loading}
          className="rounded-lg px-5 font-medium text-white shadow-sm"
          style={{ backgroundColor: accent }}
        >
          {loading ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="space-y-4">
        {packages.map((pkg, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 className="mb-3 text-base font-semibold text-slate-900">
              <input
                type="text"
                className={cn(
                  inputClass,
                  "-mx-0.5 border-transparent bg-transparent px-0.5 font-semibold shadow-none focus:border-slate-200 focus:bg-white"
                )}
                value={pkg.name}
                onChange={(e) => updatePkg(i, { name: e.target.value })}
                aria-label="Package name"
              />
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Points Required</span>
                  <input
                    type="number"
                    min={0}
                    className={cn(inputClass, "tabular-nums")}
                    value={pkg.pointsRequired}
                    onChange={(e) =>
                      updatePkg(i, {
                        pointsRequired: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      })
                    }
                  />
                </label>
                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Service Fee</span>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      className={cn(inputClass, "pr-8 tabular-nums")}
                      value={pkg.serviceFeePercent}
                      onChange={(e) =>
                        updatePkg(i, {
                          serviceFeePercent: Math.min(
                            100,
                            Math.max(0, Number(e.target.value) || 0)
                          ),
                        })
                      }
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      %
                    </span>
                  </div>
                </label>
                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Transaction limit</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      min={0}
                      className={cn(inputClass, "pl-7 tabular-nums")}
                      value={pkg.transactionLimitUsd}
                      onChange={(e) =>
                        updatePkg(i, {
                          transactionLimitUsd: Math.max(
                            0,
                            Math.floor(Number(e.target.value) || 0)
                          ),
                        })
                      }
                    />
                  </div>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {formatUsd(pkg.transactionLimitUsd)}
                  </span>
                </label>
              </div>
              <button
                type="button"
                onClick={() => removePkg(i)}
                className="flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 sm:mb-px"
                aria-label="Remove package"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addPkg}
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        style={{ color: accent, backgroundColor: `${accent}18` }}
      >
        <Plus className="h-4 w-4" />
        Add New Package
      </button>

      <div className="flex justify-center pt-1">
        <Button
          type="submit"
          form="premium-dealers-settings-form"
          disabled={loading}
          size="lg"
          className="min-w-[200px] rounded-lg px-8 font-medium text-white"
          style={{ backgroundColor: accent }}
        >
          {loading ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </form>
  );
}

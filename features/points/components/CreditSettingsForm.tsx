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
import { saveCreditSettingsAction } from "@/features/points/actions/points";
import type { PaymentMethod, PointPurchasePackage } from "@/features/points/db/points";
import { Gift, CreditCard, ShoppingBag, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const pkgInputClass =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B5CFF]/40";

const accent = "#9B5CFF";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  defaultRegistrationPoints: number;
  paymentMethods: PaymentMethod[];
  packages: PointPurchasePackage[];
};

// ─── Component ───────────────────────────────────────────────────────────────

export function CreditSettingsForm({ defaultRegistrationPoints, paymentMethods: initialMethods, packages: initialPackages }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Payment methods state
  const [methods, setMethods] = useState<PaymentMethod[]>(() => initialMethods.map((m) => ({ ...m })));

  function addMethod() {
    setMethods((prev) => [...prev, { name: "", accountName: "", phoneNumber: "", instructions: "" }]);
  }
  function removeMethod(i: number) {
    setMethods((prev) => prev.filter((_, j) => j !== i));
  }
  function updateMethod(i: number, patch: Partial<PaymentMethod>) {
    setMethods((prev) => prev.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  }

  // Packages state
  const [packages, setPackages] = useState<PointPurchasePackage[]>(() => initialPackages.map((p) => ({ ...p })));

  function addPackage() {
    setPackages((prev) => [...prev, { name: "New Package", points: 100 }]);
  }
  function removePackage(i: number) {
    setPackages((prev) => prev.filter((_, j) => j !== i));
  }
  function updatePackage(i: number, patch: Partial<PointPurchasePackage>) {
    setPackages((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("paymentMethodsJson", JSON.stringify(methods));
    formData.set("packagesJson", JSON.stringify(packages));
    const result = await saveCreditSettingsAction(formData);
    if (result?.error) setError(result.error);
    else router.refresh();
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Default Points for New Users ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gift className="size-5 text-muted-foreground" />
            <CardTitle>Default Points for New Users</CardTitle>
          </div>
          <CardDescription>
            Points credited automatically when a new user registers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-1">
            <label htmlFor="defaultRegistrationPoints" className="text-sm font-medium">
              Points
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
          </div>
        </CardContent>
      </Card>

      {/* ── Payment Methods ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="size-5 text-muted-foreground" />
            <CardTitle>Payment Methods</CardTitle>
          </div>
          <CardDescription>
            Accounts customers transfer to when buying credit point packages. Shown in the mobile app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {methods.map((m, i) => (
            <div key={i} className="rounded-lg border border-input bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Method name (e.g. KBZ Pay)"
                  className={inputClass}
                  value={m.name}
                  maxLength={100}
                  onChange={(e) => updateMethod(i, { name: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeMethod(i)}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                  aria-label="Remove method"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Account holder name"
                  className={inputClass}
                  value={m.accountName}
                  maxLength={200}
                  onChange={(e) => updateMethod(i, { accountName: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Phone number"
                  className={inputClass}
                  value={m.phoneNumber}
                  maxLength={50}
                  onChange={(e) => updateMethod(i, { phoneNumber: e.target.value })}
                />
              </div>
              <input
                type="text"
                placeholder="Instructions (optional)"
                className={inputClass}
                value={m.instructions ?? ""}
                maxLength={500}
                onChange={(e) => updateMethod(i, { instructions: e.target.value })}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addMethod}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-input px-3 py-2 text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
          >
            <Plus className="size-4" />
            Add payment method
          </button>
        </CardContent>
      </Card>

      {/* ── Point Packages ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-muted-foreground" />
            <CardTitle>Point Packages</CardTitle>
          </div>
          <CardDescription>
            Packages customers can purchase via the configured payment methods.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {packages.map((pkg, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3">
                <input
                  type="text"
                  className={cn(
                    pkgInputClass,
                    "border-transparent bg-transparent px-0 font-semibold text-base shadow-none focus:border-slate-200 focus:bg-white"
                  )}
                  value={pkg.name}
                  onChange={(e) => updatePackage(i, { name: e.target.value })}
                  aria-label="Package name"
                  placeholder="Package name"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 lg:grid-cols-5">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Credit Points</span>
                    <input
                      type="number"
                      min={1}
                      className={cn(pkgInputClass, "tabular-nums")}
                      value={pkg.points}
                      onChange={(e) => updatePackage(i, { points: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-medium text-slate-500">
                      Price MMK <span className="font-normal text-slate-400">(opt)</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      className={cn(pkgInputClass, "tabular-nums")}
                      value={pkg.priceMmk ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value) || 0));
                        updatePackage(i, { priceMmk: v });
                      }}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-medium text-slate-500">
                      Price USD <span className="font-normal text-slate-400">(opt)</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      className={cn(pkgInputClass, "tabular-nums")}
                      value={pkg.priceUsd ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value) || 0));
                        updatePackage(i, { priceUsd: v });
                      }}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-medium text-slate-500">
                      Price KRW <span className="font-normal text-slate-400">(opt)</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      className={cn(pkgInputClass, "tabular-nums")}
                      value={pkg.priceKrw ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value) || 0));
                        updatePackage(i, { priceKrw: v });
                      }}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-medium text-slate-500">Description</span>
                    <input
                      type="text"
                      maxLength={500}
                      className={pkgInputClass}
                      value={pkg.description ?? ""}
                      onChange={(e) => updatePackage(i, { description: e.target.value })}
                      placeholder="Optional note"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removePackage(i)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Remove package"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {packages.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              No packages yet. Add one below.
            </p>
          )}

          <button
            type="button"
            onClick={addPackage}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            style={{ color: accent, backgroundColor: `${accent}18` }}
          >
            <Plus className="h-4 w-4" />
            Add Package
          </button>
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex justify-end border-t pt-4">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </form>
  );
}

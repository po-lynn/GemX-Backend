"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, CreditCard, Package, Plus, Trash2, Info, Star, Shield, Eye } from "lucide-react";
import { saveCreditSettingsAction } from "@/features/points/actions/points";
import type {
  PaymentMethod,
  PointPurchasePackage,
  FeaturePricingTier,
  PremiumDealerPackage,
} from "@/features/points/db/points";
import { cn } from "@/lib/utils";

// ─── Internal state types ─────────────────────────────────────────────────────

type BankType = "kbz" | "aya" | "wave" | "cb" | "other";

type MethodState = {
  _id: string;
  name: string;
  accountName: string;
  phoneNumber: string;
  instructions?: string;
  type: BankType;
  enabled: boolean;
};

type PkgState = {
  _id: string;
  name: string;
  points: number;
  bonus: number;
  popular: boolean;
  enabled: boolean;
  priceMmk?: number | null;
  priceUsd?: number | null;
  priceKrw?: number | null;
  description?: string;
};

type FeatTierState = {
  _id: string;
  durationDays: number;
  points: number;
  badge?: string;
  enabled: boolean;
};

type DealerPkgState = {
  _id: string;
  name: string;
  pointsRequired: number;
  durationDays: number;
  enabled: boolean;
};

type Tab = "defaults" | "methods" | "packages" | "features" | "dealers";

type Props = {
  defaultRegistrationPoints: number;
  paymentMethods: PaymentMethod[];
  packages: PointPurchasePackage[];
  featureSettings: { homeFeaturedLimit: number; pricingTiers: FeaturePricingTier[] };
  dealerPackages: PremiumDealerPackage[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

const DURATION_OPTIONS = [
  { days: 1, label: "1 Day" },
  { days: 3, label: "3 Days" },
  { days: 7, label: "7 Days" },
  { days: 14, label: "14 Days" },
  { days: 30, label: "30 Days" },
];

// ─── Primitives ───────────────────────────────────────────────────────────────

const fieldCls = "flex flex-col gap-1.5 min-w-0";
const labelCls =
  "text-[12px] font-semibold text-slate-400 uppercase tracking-[0.04em]";
const inputCls =
  "w-full px-[11px] py-[9px] rounded-lg border border-slate-200 bg-white text-[15px] text-slate-900 outline-none transition-[border,box-shadow] hover:border-slate-300 focus:border-violet-600 focus:ring-[3px] focus:ring-violet-600/10";

const BANK_COLORS: Record<BankType, string> = {
  kbz: "from-red-500 to-red-400",
  aya: "from-amber-500 to-yellow-300",
  wave: "from-blue-700 to-blue-400",
  cb: "from-emerald-600 to-emerald-300",
  other: "from-violet-600 to-purple-400",
};

function BankIcon({
  type,
  name,
  lg,
}: {
  type: BankType;
  name: string;
  lg?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center text-white font-bold flex-shrink-0 bg-gradient-to-br",
        lg ? "w-9 h-9 rounded-[9px] text-sm" : "w-7 h-7 rounded-lg text-xs",
        BANK_COLORS[type]
      )}
    >
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-[18px] w-8 flex-shrink-0 cursor-pointer rounded-full transition-colors",
        on ? "bg-violet-600" : "bg-slate-300"
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] left-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform",
          on ? "translate-x-[14px]" : "translate-x-0"
        )}
      />
    </button>
  );
}

const TILE_COLORS: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700",
  blue: "bg-blue-50 text-blue-700",
  purple: "bg-violet-50 text-violet-700",
  amber: "bg-amber-50 text-amber-700",
  pink: "bg-pink-50 text-pink-700",
};

function IconTile({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg",
        TILE_COLORS[color] ?? TILE_COLORS.purple
      )}
    >
      {children}
    </span>
  );
}

function RailTab({
  active,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-[11px] w-full text-left px-[10px] py-[10px] rounded-[9px] transition-colors border-0 bg-transparent",
        active ? "bg-violet-50" : "hover:bg-slate-50"
      )}
    >
      {icon}
      <span className="flex flex-col min-w-0 flex-1 gap-0.5">
        <span
          className={cn(
            "text-[15px] font-semibold leading-none",
            active ? "text-violet-700" : "text-slate-700"
          )}
        >
          {title}
        </span>
        <span className="text-[12.5px] text-slate-400 leading-none">{sub}</span>
      </span>
    </button>
  );
}

// ─── Defaults tab ─────────────────────────────────────────────────────────────

function DefaultsTab({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="p-6">
      <header className="mb-[18px]">
        <h2 className="text-[17px] font-semibold tracking-tight mb-1">
          Default points for new users
        </h2>
        <p className="text-[13.5px] text-slate-400">
          Credited automatically the moment a user creates an account.
        </p>
      </header>
      <div className="max-w-[260px]">
        <div className={fieldCls}>
          <span className={labelCls}>Initial points</span>
          <div className="relative">
            <input
              className={cn(inputCls, "pr-12 font-mono")}
              type="number"
              min={0}
              value={value}
              onChange={(e) =>
                onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))
              }
            />
            <span className="absolute right-[11px] top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded pointer-events-none">
              pts
            </span>
          </div>
          <span className="text-[13px] text-slate-400">
            Recommended: 5–25 pts to onboard without abuse.
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Methods tab ──────────────────────────────────────────────────────────────

function MethodsTab({
  methods,
  setMethods,
  selected,
  setSelected,
}: {
  methods: MethodState[];
  setMethods: React.Dispatch<React.SetStateAction<MethodState[]>>;
  selected: string | null;
  setSelected: (id: string | null) => void;
}) {
  const m = methods.find((x) => x._id === selected) ?? null;

  const addMethod = () => {
    const id = "_m" + Date.now();
    setMethods((prev) => [
      ...prev,
      {
        _id: id,
        name: "New method",
        accountName: "",
        phoneNumber: "",
        instructions: "",
        type: "other",
        enabled: true,
      },
    ]);
    setSelected(id);
  };

  const removeMethod = () => {
    if (!m) return;
    const remaining = methods.filter((x) => x._id !== m._id);
    setMethods(remaining);
    setSelected(remaining[0]?._id ?? null);
  };

  const update = (patch: Partial<MethodState>) => {
    if (!m) return;
    setMethods((prev) =>
      prev.map((x) => (x._id === m._id ? { ...x, ...patch } : x))
    );
  };

  return (
    <div
      className="grid min-h-full flex-1"
      style={{ gridTemplateColumns: "240px 1fr" }}
    >
      {/* Master list */}
      <ul className="list-none m-0 p-2 border-r border-slate-100 bg-slate-50/60 flex flex-col gap-0.5">
        {methods.map((x) => (
          <li
            key={x._id}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer select-none",
              selected === x._id
                ? "bg-white shadow-[0_0_0_1px_#DFE3EB,0_1px_2px_rgba(15,20,35,0.04)]"
                : "hover:bg-white"
            )}
            onClick={() => setSelected(x._id)}
          >
            <BankIcon type={x.type} name={x.name} />
            <span className="flex flex-col flex-1 min-w-0">
              <span className="text-[14px] font-semibold text-slate-800 truncate">
                {x.name || "Unnamed"}
              </span>
              <span className="text-[12px] text-slate-400 font-mono truncate">
                {x.phoneNumber || "—"}
              </span>
            </span>
            {!x.enabled && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">
                off
              </span>
            )}
          </li>
        ))}
        <li
          className="flex items-center gap-1.5 px-2.5 py-2 mt-1 rounded-lg cursor-pointer text-[13.5px] font-medium text-slate-400 border border-dashed border-slate-200 hover:text-violet-700 hover:border-violet-400 hover:bg-white transition-colors select-none"
          onClick={addMethod}
        >
          <Plus className="w-3.5 h-3.5" />
          Add method
        </li>
      </ul>

      {/* Detail */}
      {m ? (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-3 px-[22px] py-4 border-b border-slate-100">
            <BankIcon type={m.type} name={m.name} lg />
            <div className="flex-1 min-w-0">
              <div className="text-[17px] font-semibold text-slate-900 truncate">
                {m.name || "New method"}
              </div>
              <div className="text-[13px] text-slate-400 mt-0.5">
                Customers see these details when buying points.
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 border border-slate-200 rounded-full flex-shrink-0">
              <span className="text-[13px] text-slate-500">
                {m.enabled ? "Enabled" : "Disabled"}
              </span>
              <Toggle on={m.enabled} onChange={(v) => update({ enabled: v })} />
            </div>
          </div>

          <div className="p-[22px]">
            <div className="grid grid-cols-2 gap-3">
              <div className={fieldCls}>
                <span className={labelCls}>Method name</span>
                <input
                  className={inputCls}
                  value={m.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="e.g. KBZ Pay"
                  maxLength={100}
                />
              </div>
              <div className={fieldCls}>
                <span className={labelCls}>Provider type</span>
                <select
                  className={inputCls}
                  value={m.type}
                  onChange={(e) => update({ type: e.target.value as BankType })}
                >
                  <option value="kbz">KBZ Pay</option>
                  <option value="aya">AYA Pay</option>
                  <option value="wave">Wave Money</option>
                  <option value="cb">CB Pay</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className={fieldCls}>
                <span className={labelCls}>Account holder</span>
                <input
                  className={inputCls}
                  value={m.accountName}
                  onChange={(e) => update({ accountName: e.target.value })}
                  placeholder="Account holder name"
                  maxLength={200}
                />
              </div>
              <div className={fieldCls}>
                <span className={labelCls}>Phone number</span>
                <input
                  className={cn(inputCls, "font-mono")}
                  value={m.phoneNumber}
                  onChange={(e) => update({ phoneNumber: e.target.value })}
                  placeholder="09-xxxx-xxxx"
                  maxLength={50}
                />
              </div>
            </div>

            <div className={cn(fieldCls, "mt-3")}>
              <span className={labelCls}>Instructions to customer</span>
              <textarea
                className={cn(inputCls, "resize-none")}
                rows={2}
                value={m.instructions ?? ""}
                onChange={(e) => update({ instructions: e.target.value })}
                placeholder='e.g. "Send and use your username as reference."'
                maxLength={500}
              />
              <span className="text-[13px] text-slate-400">
                Shown in the mobile app when the customer selects this method.
              </span>
            </div>

            <div className="mt-[18px] pt-3.5 border-t border-slate-100 flex">
              <button
                type="button"
                onClick={removeMethod}
                className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-md text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete this method
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center p-8 text-sm text-slate-400">
          Select a method or add one
        </div>
      )}
    </div>
  );
}

// ─── Packages tab ─────────────────────────────────────────────────────────────

function PackagesTab({
  packages,
  setPackages,
  selected,
  setSelected,
}: {
  packages: PkgState[];
  setPackages: React.Dispatch<React.SetStateAction<PkgState[]>>;
  selected: string | null;
  setSelected: (id: string | null) => void;
}) {
  const p = packages.find((x) => x._id === selected) ?? null;

  const addPkg = () => {
    const id = "_p" + Date.now();
    setPackages((prev) => [
      ...prev,
      {
        _id: id,
        name: "New tier",
        points: 100,
        bonus: 0,
        popular: false,
        enabled: true,
        priceMmk: 10000,
      },
    ]);
    setSelected(id);
  };

  const removePkg = () => {
    if (!p) return;
    const remaining = packages.filter((x) => x._id !== p._id);
    setPackages(remaining);
    setSelected(remaining[0]?._id ?? null);
  };

  const update = (patch: Partial<PkgState>) => {
    if (!p) return;
    setPackages((prev) =>
      prev.map((x) => (x._id === p._id ? { ...x, ...patch } : x))
    );
  };

  const togglePopular = (v: boolean) => {
    setPackages((prev) =>
      prev.map((x) => ({ ...x, popular: x._id === p?._id ? v : false }))
    );
  };

  const totalPts = p ? p.points + (p.bonus ?? 0) : 0;
  const rate =
    p && (p.priceMmk ?? 0) > 0 && totalPts > 0
      ? ((p.priceMmk ?? 0) / totalPts).toFixed(1)
      : "—";

  return (
    <div
      className="grid min-h-full flex-1"
      style={{ gridTemplateColumns: "240px 1fr" }}
    >
      {/* Master list */}
      <ul className="list-none m-0 p-2 border-r border-slate-100 bg-slate-50/60 flex flex-col gap-0.5">
        {packages.map((x) => (
          <li
            key={x._id}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer select-none",
              selected === x._id
                ? "bg-white shadow-[0_0_0_1px_#DFE3EB,0_1px_2px_rgba(15,20,35,0.04)]"
                : "hover:bg-white"
            )}
            onClick={() => setSelected(x._id)}
          >
            <span className="bg-violet-50 text-violet-700 px-2 py-1 rounded-md text-[13px] font-bold font-mono min-w-[52px] text-center flex-shrink-0">
              {fmtNum(x.points)}
            </span>
            <span className="flex flex-col flex-1 min-w-0">
              <span className="text-[14px] font-semibold text-slate-800 truncate">
                {x.name}
              </span>
              <span className="text-[12px] text-slate-400 font-mono truncate">
                {x.priceMmk != null ? `MMK ${fmtNum(x.priceMmk)}` : "—"}
              </span>
            </span>
            {x.popular && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 flex-shrink-0">
                ★
              </span>
            )}
          </li>
        ))}
        <li
          className="flex items-center gap-1.5 px-2.5 py-2 mt-1 rounded-lg cursor-pointer text-[13.5px] font-medium text-slate-400 border border-dashed border-slate-200 hover:text-violet-700 hover:border-violet-400 hover:bg-white transition-colors select-none"
          onClick={addPkg}
        >
          <Plus className="w-3.5 h-3.5" />
          Add package
        </li>
      </ul>

      {/* Detail */}
      {p ? (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-3 px-[22px] py-4 border-b border-slate-100">
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-bold text-violet-700 leading-none tracking-tight font-mono">
                {fmtNum(p.points)}
              </span>
              <span className="text-[14px] text-slate-400 font-semibold">
                points
              </span>
              {(p.bonus ?? 0) > 0 && (
                <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  +{p.bonus} bonus
                </span>
              )}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2 px-3 py-1 border border-slate-200 rounded-full flex-shrink-0">
              <span className="text-[13px] text-slate-500">
                {p.enabled ? "Live" : "Hidden"}
              </span>
              <Toggle on={p.enabled} onChange={(v) => update({ enabled: v })} />
            </div>
          </div>

          <div className="p-[22px]">
            <div className="grid grid-cols-2 gap-3">
              <div className={fieldCls}>
                <span className={labelCls}>Package name</span>
                <input
                  className={inputCls}
                  value={p.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="e.g. Starter"
                  maxLength={200}
                />
              </div>
              <div />
              <div className={fieldCls}>
                <span className={labelCls}>Base points</span>
                <input
                  className={cn(inputCls, "font-mono")}
                  type="number"
                  min={1}
                  value={p.points}
                  onChange={(e) =>
                    update({
                      points: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                    })
                  }
                />
              </div>
              <div className={fieldCls}>
                <span className={labelCls}>Bonus points</span>
                <input
                  className={cn(inputCls, "font-mono")}
                  type="number"
                  min={0}
                  value={p.bonus ?? 0}
                  onChange={(e) =>
                    update({
                      bonus: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    })
                  }
                />
              </div>
              <div className={fieldCls}>
                <span className={labelCls}>Price</span>
                <div className="relative">
                  <span className="absolute left-[11px] top-1/2 -translate-y-1/2 text-[13px] text-slate-400 pointer-events-none">
                    MMK
                  </span>
                  <input
                    className={cn(inputCls, "pl-[46px] font-mono")}
                    type="number"
                    min={0}
                    value={p.priceMmk ?? ""}
                    placeholder="—"
                    onChange={(e) => {
                      const v =
                        e.target.value === ""
                          ? null
                          : Math.max(0, Math.floor(Number(e.target.value) || 0));
                      update({ priceMmk: v });
                    }}
                  />
                </div>
              </div>
              <div className={fieldCls}>
                <span className={labelCls}>Per-point rate</span>
                <div className="relative">
                  <input
                    className={cn(inputCls, "pr-[70px] font-mono bg-slate-50")}
                    readOnly
                    value={rate}
                  />
                  <span className="absolute right-[11px] top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium pointer-events-none">
                    MMK/pt
                  </span>
                </div>
              </div>
              <div className={fieldCls}>
                <span className={labelCls}>
                  Price USD{" "}
                  <span className="font-normal normal-case tracking-normal text-slate-300">
                    (opt)
                  </span>
                </span>
                <input
                  className={cn(inputCls, "font-mono")}
                  type="number"
                  min={0}
                  value={p.priceUsd ?? ""}
                  placeholder="—"
                  onChange={(e) => {
                    const v =
                      e.target.value === ""
                        ? null
                        : Math.max(0, Math.floor(Number(e.target.value) || 0));
                    update({ priceUsd: v });
                  }}
                />
              </div>
              <div className={fieldCls}>
                <span className={labelCls}>
                  Price KRW{" "}
                  <span className="font-normal normal-case tracking-normal text-slate-300">
                    (opt)
                  </span>
                </span>
                <input
                  className={cn(inputCls, "font-mono")}
                  type="number"
                  min={0}
                  value={p.priceKrw ?? ""}
                  placeholder="—"
                  onChange={(e) => {
                    const v =
                      e.target.value === ""
                        ? null
                        : Math.max(0, Math.floor(Number(e.target.value) || 0));
                    update({ priceKrw: v });
                  }}
                />
              </div>
            </div>

            <label className="mt-3.5 flex gap-2.5 items-start p-3 rounded-[10px] border border-slate-200 bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-violet-600"
                checked={p.popular}
                onChange={(e) => togglePopular(e.target.checked)}
              />
              <span>
                <span className="text-[14px] font-semibold text-slate-800 block">
                  Mark as popular
                </span>
                <span className="text-[13px] text-slate-400 block mt-0.5">
                  Highlights this tier with a badge in the app. Only one allowed.
                </span>
              </span>
            </label>

            <div className="mt-[18px] pt-3.5 border-t border-slate-100 flex">
              <button
                type="button"
                onClick={removePkg}
                className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-md text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete tier
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center p-8 text-sm text-slate-400">
          Select a package or add one
        </div>
      )}
    </div>
  );
}

// ─── Features tab ─────────────────────────────────────────────────────────────

function FeaturesTab({
  featTiers,
  setFeatTiers,
  selected,
  setSelected,
  featLimit,
  setFeatLimit,
}: {
  featTiers: FeatTierState[];
  setFeatTiers: React.Dispatch<React.SetStateAction<FeatTierState[]>>;
  selected: string | null;
  setSelected: (id: string | null) => void;
  featLimit: number;
  setFeatLimit: React.Dispatch<React.SetStateAction<number>>;
}) {
  const f = featTiers.find((x) => x._id === selected) ?? null;

  const addTier = () => {
    const id = "_f" + Date.now();
    setFeatTiers((prev) => [
      ...prev,
      { _id: id, durationDays: 1, points: 100, badge: undefined, enabled: true },
    ]);
    setSelected(id);
  };

  const removeTier = () => {
    if (!f) return;
    const remaining = featTiers.filter((x) => x._id !== f._id);
    setFeatTiers(remaining);
    setSelected(remaining[0]?._id ?? null);
  };

  const update = (patch: Partial<FeatTierState>) => {
    if (!f) return;
    setFeatTiers((prev) =>
      prev.map((x) => (x._id === f._id ? { ...x, ...patch } : x))
    );
  };

  const durLabel = (days: number) =>
    DURATION_OPTIONS.find((d) => d.days === days)?.label ?? `${days} Days`;
  const perDayRate =
    f && f.durationDays > 0 ? (f.points / f.durationDays).toFixed(1) : "—";

  return (
    <div
      className="grid min-h-full flex-1"
      style={{ gridTemplateColumns: "240px 1fr" }}
    >
      {/* Master list */}
      <ul className="list-none m-0 p-2 border-r border-slate-100 bg-slate-50/60 flex flex-col gap-0.5">
        {featTiers.map((x) => (
          <li
            key={x._id}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer select-none",
              selected === x._id
                ? "bg-white shadow-[0_0_0_1px_#DFE3EB,0_1px_2px_rgba(15,20,35,0.04)]"
                : "hover:bg-white"
            )}
            onClick={() => setSelected(x._id)}
          >
            <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-md text-[12px] font-bold font-mono min-w-[36px] text-center flex-shrink-0">
              {x.durationDays}d
            </span>
            <span className="flex flex-col flex-1 min-w-0">
              <span className="text-[14px] font-semibold text-slate-800 truncate">
                {durLabel(x.durationDays)}
              </span>
              <span className="text-[12px] text-slate-400 font-mono truncate">
                {fmtNum(x.points)} pts
              </span>
            </span>
            {x.badge && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 flex-shrink-0 truncate max-w-[64px]">
                {x.badge}
              </span>
            )}
            {!x.enabled && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">
                off
              </span>
            )}
          </li>
        ))}
        <li
          className="flex items-center gap-1.5 px-2.5 py-2 mt-1 rounded-lg cursor-pointer text-[13.5px] font-medium text-slate-400 border border-dashed border-slate-200 hover:text-violet-700 hover:border-violet-400 hover:bg-white transition-colors select-none"
          onClick={addTier}
        >
          <Plus className="w-3.5 h-3.5" />
          Add option
        </li>
      </ul>

      {/* Detail */}
      {f ? (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-3 px-[22px] py-4 border-b border-slate-100">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[28px] font-bold text-violet-700 leading-none tracking-tight font-mono">
                {fmtNum(f.points)}
              </span>
              <span className="text-[14px] text-slate-400 font-semibold">
                pts · {durLabel(f.durationDays)}
              </span>
              {f.badge && (
                <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                  {f.badge}
                </span>
              )}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2 px-3 py-1 border border-slate-200 rounded-full flex-shrink-0">
              <span className="text-[13px] text-slate-500">
                {f.enabled ? "Live" : "Hidden"}
              </span>
              <Toggle on={f.enabled} onChange={(v) => update({ enabled: v })} />
            </div>
          </div>

          <div className="p-[22px]">
            <div className="grid grid-cols-2 gap-3">
              <div className={fieldCls}>
                <span className={labelCls}>Duration</span>
                <select
                  className={inputCls}
                  value={f.durationDays}
                  onChange={(e) =>
                    update({ durationDays: Number(e.target.value) })
                  }
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d.days} value={d.days}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={fieldCls}>
                <span className={labelCls}>Points cost</span>
                <div className="relative">
                  <input
                    className={cn(inputCls, "pr-12 font-mono")}
                    type="number"
                    min={0}
                    value={f.points}
                    onChange={(e) =>
                      update({
                        points: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      })
                    }
                  />
                  <span className="absolute right-[11px] top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded pointer-events-none">
                    pts
                  </span>
                </div>
              </div>
              <div className={fieldCls}>
                <span className={labelCls}>Badge label</span>
                <input
                  className={inputCls}
                  placeholder="Optional — e.g. Best Value"
                  value={f.badge ?? ""}
                  onChange={(e) =>
                    update({ badge: e.target.value || undefined })
                  }
                  maxLength={50}
                />
                <span className="text-[13px] text-slate-400">
                  Shown next to this option in the seller flow.
                </span>
              </div>
              <div className={fieldCls}>
                <span className={labelCls}>Per-day rate</span>
                <div className="relative">
                  <input
                    className={cn(inputCls, "pr-[70px] font-mono bg-slate-50")}
                    readOnly
                    value={perDayRate}
                  />
                  <span className="absolute right-[11px] top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium pointer-events-none">
                    pts/day
                  </span>
                </div>
              </div>
            </div>

            {/* Feature product limit */}
            <div className="mt-3.5 flex gap-2.5 items-start p-3 rounded-[10px] border border-slate-200 bg-slate-50">
              <IconTile color="purple">
                <Eye className="w-3.5 h-3.5" />
              </IconTile>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-slate-800">
                  Feature product limit
                </div>
                <div className="text-[13px] text-slate-400 mt-0.5">
                  Max number of featured products on the homepage at once. Applies
                  across all durations.
                </div>
              </div>
              <div className="flex items-stretch border border-slate-200 rounded-lg overflow-hidden bg-white flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setFeatLimit((n) => Math.max(1, n - 1))}
                  className="flex w-8 items-center justify-center border-r border-slate-200 text-slate-600 hover:bg-slate-50 text-base leading-none"
                  aria-label="Decrease"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="w-12 text-center text-[14px] font-semibold text-slate-900 bg-transparent outline-none border-0 font-mono"
                  value={featLimit}
                  onChange={(e) =>
                    setFeatLimit(
                      Math.min(100, Math.max(1, Math.floor(Number(e.target.value) || 1)))
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => setFeatLimit((n) => Math.min(100, n + 1))}
                  className="flex w-8 items-center justify-center border-l border-slate-200 text-slate-600 hover:bg-slate-50 text-base leading-none"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-[18px] pt-3.5 border-t border-slate-100 flex">
              <button
                type="button"
                onClick={removeTier}
                className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-md text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete this option
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center p-8 text-sm text-slate-400">
          Select an option or add one
        </div>
      )}
    </div>
  );
}

// ─── Dealers tab ──────────────────────────────────────────────────────────────

function DealersTab({
  dealerPkgs,
  setDealerPkgs,
  selected,
  setSelected,
}: {
  dealerPkgs: DealerPkgState[];
  setDealerPkgs: React.Dispatch<React.SetStateAction<DealerPkgState[]>>;
  selected: string | null;
  setSelected: (id: string | null) => void;
}) {
  const d = dealerPkgs.find((x) => x._id === selected) ?? null;

  const addDealer = () => {
    const id = "_d" + Date.now();
    setDealerPkgs((prev) => [
      ...prev,
      { _id: id, name: "New Package", pointsRequired: 100, durationDays: 30, enabled: true },
    ]);
    setSelected(id);
  };

  const removeDealer = () => {
    if (!d) return;
    const remaining = dealerPkgs.filter((x) => x._id !== d._id);
    setDealerPkgs(remaining);
    setSelected(remaining[0]?._id ?? null);
  };

  const update = (patch: Partial<DealerPkgState>) => {
    if (!d) return;
    setDealerPkgs((prev) =>
      prev.map((x) => (x._id === d._id ? { ...x, ...patch } : x))
    );
  };

  const perDayRate =
    d && d.durationDays > 0
      ? (d.pointsRequired / d.durationDays).toFixed(1)
      : "—";

  return (
    <div
      className="grid min-h-full flex-1"
      style={{ gridTemplateColumns: "240px 1fr" }}
    >
      {/* Master list */}
      <ul className="list-none m-0 p-2 border-r border-slate-100 bg-slate-50/60 flex flex-col gap-0.5">
        {dealerPkgs.map((x) => (
          <li
            key={x._id}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer select-none",
              selected === x._id
                ? "bg-white shadow-[0_0_0_1px_#DFE3EB,0_1px_2px_rgba(15,20,35,0.04)]"
                : "hover:bg-white"
            )}
            onClick={() => setSelected(x._id)}
          >
            <span className="bg-pink-50 text-pink-700 px-2 py-1 rounded-md text-[13px] font-bold font-mono min-w-[52px] text-center flex-shrink-0">
              {fmtNum(x.pointsRequired)}
            </span>
            <span className="flex flex-col flex-1 min-w-0">
              <span className="text-[14px] font-semibold text-slate-800 truncate">
                {x.name}
              </span>
              <span className="text-[12px] text-slate-400 font-mono truncate">
                {x.durationDays} days
              </span>
            </span>
            {!x.enabled && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">
                off
              </span>
            )}
          </li>
        ))}
        <li
          className="flex items-center gap-1.5 px-2.5 py-2 mt-1 rounded-lg cursor-pointer text-[13.5px] font-medium text-slate-400 border border-dashed border-slate-200 hover:text-violet-700 hover:border-violet-400 hover:bg-white transition-colors select-none"
          onClick={addDealer}
        >
          <Plus className="w-3.5 h-3.5" />
          Add package
        </li>
      </ul>

      {/* Detail */}
      {d ? (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-3 px-[22px] py-4 border-b border-slate-100">
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-bold text-violet-700 leading-none tracking-tight font-mono">
                {fmtNum(d.pointsRequired)}
              </span>
              <span className="text-[14px] text-slate-400 font-semibold">
                pts · {d.durationDays} days
              </span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2 px-3 py-1 border border-slate-200 rounded-full flex-shrink-0">
              <span className="text-[13px] text-slate-500">
                {d.enabled ? "Live" : "Hidden"}
              </span>
              <Toggle on={d.enabled} onChange={(v) => update({ enabled: v })} />
            </div>
          </div>

          <div className="p-[22px]">
            <div className="grid grid-cols-2 gap-3">
              <div className={fieldCls}>
                <span className={labelCls}>Package name</span>
                <input
                  className={inputCls}
                  value={d.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="e.g. Basic Package"
                  maxLength={120}
                />
              </div>
              <div />
              <div className={fieldCls}>
                <span className={labelCls}>Points required</span>
                <div className="relative">
                  <input
                    className={cn(inputCls, "pr-12 font-mono")}
                    type="number"
                    min={0}
                    value={d.pointsRequired}
                    onChange={(e) =>
                      update({
                        pointsRequired: Math.max(
                          0,
                          Math.floor(Number(e.target.value) || 0)
                        ),
                      })
                    }
                  />
                  <span className="absolute right-[11px] top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded pointer-events-none">
                    pts
                  </span>
                </div>
              </div>
              <div className={fieldCls}>
                <span className={labelCls}>Duration</span>
                <div className="relative">
                  <input
                    className={cn(inputCls, "pr-16 font-mono")}
                    type="number"
                    min={1}
                    max={3650}
                    value={d.durationDays}
                    onChange={(e) =>
                      update({
                        durationDays: Math.min(
                          3650,
                          Math.max(1, Math.floor(Number(e.target.value) || 30))
                        ),
                      })
                    }
                  />
                  <span className="absolute right-[11px] top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded pointer-events-none">
                    days
                  </span>
                </div>
              </div>
              <div className={fieldCls}>
                <span className={labelCls}>Per-day rate</span>
                <div className="relative">
                  <input
                    className={cn(inputCls, "pr-[70px] font-mono bg-slate-50")}
                    readOnly
                    value={perDayRate}
                  />
                  <span className="absolute right-[11px] top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium pointer-events-none">
                    pts/day
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-[18px] pt-3.5 border-t border-slate-100 flex">
              <button
                type="button"
                onClick={removeDealer}
                className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-md text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete this package
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center p-8 text-sm text-slate-400">
          Select a package or add one
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CreditSettingsForm({
  defaultRegistrationPoints,
  paymentMethods: initialMethods,
  packages: initialPackages,
  featureSettings: initialFeatureSettings,
  dealerPackages: initialDealerPackages,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("packages");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [defaultPts, setDefaultPts] = useState(defaultRegistrationPoints);

  const [methods, setMethods] = useState<MethodState[]>(() =>
    initialMethods.map((m, i) => ({
      _id: `m${i}`,
      name: m.name,
      accountName: m.accountName,
      phoneNumber: m.phoneNumber,
      instructions: m.instructions,
      type: (m.type as BankType | undefined) ?? "other",
      enabled: m.enabled ?? true,
    }))
  );
  const [selectedMethod, setSelectedMethod] = useState<string | null>(
    methods[0]?._id ?? null
  );

  const [packages, setPackages] = useState<PkgState[]>(() =>
    initialPackages.map((p, i) => ({
      _id: `p${i}`,
      name: p.name,
      points: p.points,
      bonus: p.bonus ?? 0,
      popular: p.popular ?? false,
      enabled: p.enabled ?? true,
      priceMmk: p.priceMmk,
      priceUsd: p.priceUsd,
      priceKrw: p.priceKrw,
      description: p.description,
    }))
  );
  const [selectedPkg, setSelectedPkg] = useState<string | null>(
    packages[0]?._id ?? null
  );

  const [featTiers, setFeatTiers] = useState<FeatTierState[]>(() =>
    initialFeatureSettings.pricingTiers.map((t, i) => ({
      _id: `f${i}`,
      durationDays: t.durationDays,
      points: t.points,
      badge: t.badge,
      enabled: t.enabled ?? true,
    }))
  );
  const [selectedFeat, setSelectedFeat] = useState<string | null>(
    featTiers[0]?._id ?? null
  );
  const [featLimit, setFeatLimit] = useState(
    initialFeatureSettings.homeFeaturedLimit
  );

  const [dealerPkgs, setDealerPkgs] = useState<DealerPkgState[]>(() =>
    initialDealerPackages.map((p, i) => ({
      _id: `d${i}`,
      name: p.name,
      pointsRequired: p.pointsRequired,
      durationDays: p.durationDays,
      enabled: p.enabled ?? true,
    }))
  );
  const [selectedDealer, setSelectedDealer] = useState<string | null>(
    dealerPkgs[0]?._id ?? null
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.set("defaultRegistrationPoints", String(defaultPts));
    formData.set(
      "paymentMethodsJson",
      JSON.stringify(methods.map(({ _id: _unused, ...rest }) => rest))
    );
    formData.set(
      "packagesJson",
      JSON.stringify(packages.map(({ _id: _unused, ...rest }) => rest))
    );
    formData.set(
      "featureTiersJson",
      JSON.stringify(featTiers.map(({ _id: _unused, ...rest }) => rest))
    );
    formData.set("homeFeaturedLimit", String(featLimit));
    formData.set(
      "dealerPackagesJson",
      JSON.stringify(dealerPkgs.map(({ _id: _unused, ...rest }) => rest))
    );

    const result = await saveCreditSettingsAction(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Page header */}
      <div className="flex items-end justify-between gap-6 mb-[22px]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">
            Point Packages
          </h1>
          <p className="text-[15px] text-slate-500">
            Configure default points, payment methods, and purchasable packages.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {saved && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Saved
            </span>
          )}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-[14px] font-medium hover:bg-violet-700 disabled:opacity-60 transition-colors"
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Two-column workspace: left rail + right pane */}
      <div
        className="grid gap-[18px] items-stretch min-h-[520px]"
        style={{ gridTemplateColumns: "264px 1fr" }}
      >
        {/* Left rail */}
        <aside className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col gap-1">
          <RailTab
            active={tab === "defaults"}
            onClick={() => setTab("defaults")}
            icon={
              <IconTile color="green">
                <Gift className="w-3.5 h-3.5" />
              </IconTile>
            }
            title="Defaults"
            sub={`${fmtNum(defaultPts)} pts on signup`}
          />
          <RailTab
            active={tab === "methods"}
            onClick={() => setTab("methods")}
            icon={
              <IconTile color="blue">
                <CreditCard className="w-3.5 h-3.5" />
              </IconTile>
            }
            title="Payment Methods"
            sub={`${methods.filter((m) => m.enabled).length} active · ${methods.length} total`}
          />
          <RailTab
            active={tab === "packages"}
            onClick={() => setTab("packages")}
            icon={
              <IconTile color="purple">
                <Package className="w-3.5 h-3.5" />
              </IconTile>
            }
            title="Point Packages"
            sub={`${packages.length} tier${packages.length === 1 ? "" : "s"}`}
          />
          <RailTab
            active={tab === "features"}
            onClick={() => setTab("features")}
            icon={
              <IconTile color="amber">
                <Star className="w-3.5 h-3.5" />
              </IconTile>
            }
            title="Feature Settings"
            sub={`${featTiers.length} option${featTiers.length === 1 ? "" : "s"} · max ${featLimit}`}
          />
          <RailTab
            active={tab === "dealers"}
            onClick={() => setTab("dealers")}
            icon={
              <IconTile color="pink">
                <Shield className="w-3.5 h-3.5" />
              </IconTile>
            }
            title="Premium Dealers"
            sub={`${dealerPkgs.length} package${dealerPkgs.length === 1 ? "" : "s"}`}
          />

          <div className="mt-auto pt-2">
            <div className="flex gap-2.5 p-3 rounded-[9px] bg-violet-50 text-violet-700">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-[13px] font-semibold">
                  Live in customer app
                </div>
                <div className="text-[12.5px] text-slate-600 mt-0.5 leading-[1.4]">
                  Changes here appear in the mobile app within ~1 minute of
                  saving.
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Right pane */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          {tab === "defaults" && (
            <DefaultsTab value={defaultPts} onChange={setDefaultPts} />
          )}
          {tab === "methods" && (
            <MethodsTab
              methods={methods}
              setMethods={setMethods}
              selected={selectedMethod}
              setSelected={setSelectedMethod}
            />
          )}
          {tab === "packages" && (
            <PackagesTab
              packages={packages}
              setPackages={setPackages}
              selected={selectedPkg}
              setSelected={setSelectedPkg}
            />
          )}
          {tab === "features" && (
            <FeaturesTab
              featTiers={featTiers}
              setFeatTiers={setFeatTiers}
              selected={selectedFeat}
              setSelected={setSelectedFeat}
              featLimit={featLimit}
              setFeatLimit={setFeatLimit}
            />
          )}
          {tab === "dealers" && (
            <DealersTab
              dealerPkgs={dealerPkgs}
              setDealerPkgs={setDealerPkgs}
              selected={selectedDealer}
              setSelected={setSelectedDealer}
            />
          )}
        </section>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}

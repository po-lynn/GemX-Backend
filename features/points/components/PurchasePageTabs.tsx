"use client"

import { useState } from "react"
import { ArrowDownToLine, UserPlus } from "lucide-react"
import { PurchaseForm } from "./PurchaseForm"
import { AdminCreditPointsForm } from "./AdminCreditPointsForm"
import type { PointPurchasePackage, PaymentMethod } from "@/features/points/db/points"

type UserOption = {
  id: string
  name: string
  email: string
  phone: string | null
  points: number
  role: string
}

type Props = {
  packages: PointPurchasePackage[]
  paymentMethods: PaymentMethod[]
  users: UserOption[]
  successRedirect?: string
}

const tabs = [
  { id: "topup",  label: "Top up (myself)",  icon: ArrowDownToLine, desc: "Submit a payment transfer — pending admin approval" },
  { id: "credit", label: "Credit a user",     icon: UserPlus,        desc: "Directly add or remove points from any account" },
] as const

type Tab = (typeof tabs)[number]["id"]

export function PurchasePageTabs({ packages, paymentMethods, users, successRedirect }: Props) {
  const [active, setActive] = useState<Tab>("topup")

  return (
    <div>
      {/* Tab strip */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 20,
        border: "1px solid var(--lv-border)", borderRadius: 10, overflow: "hidden",
        background: "var(--lv-panel-2)",
      }}>
        {tabs.map((t) => {
          const Icon = t.icon
          const on = active === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              style={{
                flex: 1, padding: "12px 16px", border: "none", cursor: "pointer",
                background: on ? "#fff" : "transparent",
                borderBottom: on ? "2px solid var(--lv-accent)" : "2px solid transparent",
                transition: "all .15s", textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                <Icon style={{ width: 14, height: 14, color: on ? "var(--lv-accent)" : "var(--lv-text-3)", flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: on ? "var(--lv-text)" : "var(--lv-text-2)" }}>
                  {t.label}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--lv-text-3)", paddingLeft: 21 }}>
                {t.desc}
              </div>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="lv-card" style={{ padding: "24px 28px" }}>
        {active === "topup" && (
          <PurchaseForm
            packages={packages}
            paymentMethods={paymentMethods}
            successRedirect={successRedirect}
          />
        )}
        {active === "credit" && (
          <AdminCreditPointsForm users={users} />
        )}
      </div>
    </div>
  )
}

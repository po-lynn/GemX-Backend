"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Building2, Shield } from "lucide-react"
import { CompanySettingsForm } from "@/features/company-settings/components/CompanySettingsForm"
import { EscrowServiceSettingsForm } from "@/features/escrow-service-settings/components/EscrowServiceSettingsForm"
import type { CompanySettings } from "@/features/company-settings/db/company-settings"
import type { EscrowServiceSettings } from "@/features/escrow-service-settings/db/escrow-service-settings"

type Tab = "company" | "escrow"

type User = { id: string; name: string; email: string; role: string }

type Props = {
  initialTab: Tab
  companySettings: CompanySettings | null
  escrowSettings: EscrowServiceSettings | null
  internalUsers: User[]
}

const TAB_SUBTITLES: Record<Tab, string> = {
  company: "Manage your company profile and brand details across the marketplace.",
  escrow: "Assign the officer who manages escrow transactions between buyers and sellers.",
}

const tabBaseStyle =
  "inline-flex items-center gap-[7px] border-none rounded-[9px] px-[17px] py-[9px] text-[13px] font-semibold cursor-pointer transition-all"
const tabOnStyle = `${tabBaseStyle} bg-white text-[#7c5cff]`
const tabOffStyle = `${tabBaseStyle} bg-transparent text-[#8a8f9c]`

export function SettingsPageClient({ initialTab, companySettings, escrowSettings, internalUsers }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(initialTab)

  function switchTab(t: Tab) {
    setTab(t)
    const url = new URL(window.location.href)
    url.searchParams.set("tab", t)
    router.replace(url.pathname + url.search, { scroll: false })
  }

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      {/* Page heading */}
      <div className="mb-5 flex items-start gap-[14px]">
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-0.5 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border text-muted-foreground hover:bg-muted/50"
          aria-label="Back"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1
            className="text-[25px] font-semibold leading-tight tracking-tight"
            style={{ fontFamily: "Poppins, sans-serif", color: "#1c1d2b" }}
          >
            Settings
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#8a8f9c" }}>
            {TAB_SUBTITLES[tab]}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="mb-[22px] flex gap-[6px] rounded-xl p-1"
        style={{ background: "#ececf1", width: "fit-content" }}
      >
        <button
          type="button"
          className={tab === "company" ? tabOnStyle : tabOffStyle}
          style={tab === "company" ? { boxShadow: "0 1px 3px rgba(28,29,43,.1)", fontFamily: "Poppins, sans-serif" } : { fontFamily: "Poppins, sans-serif" }}
          onClick={() => switchTab("company")}
        >
          <Building2 size={15} />
          Company Information
        </button>
        <button
          type="button"
          className={tab === "escrow" ? tabOnStyle : tabOffStyle}
          style={tab === "escrow" ? { boxShadow: "0 1px 3px rgba(28,29,43,.1)", fontFamily: "Poppins, sans-serif" } : { fontFamily: "Poppins, sans-serif" }}
          onClick={() => switchTab("escrow")}
        >
          <Shield size={15} />
          Escrow Service
        </button>
      </div>

      {/* Tab panels */}
      {tab === "company" && <CompanySettingsForm settings={companySettings} users={internalUsers} />}
      {tab === "escrow" && (
        <EscrowServiceSettingsForm
          settings={escrowSettings}
          users={internalUsers}
          embedded
        />
      )}
    </div>
  )
}

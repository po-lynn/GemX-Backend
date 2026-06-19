"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Mail, Phone, MapPin, Building2, User } from "lucide-react"
import { toast } from "sonner"
import { saveCompanySettingsAction } from "@/features/company-settings/actions/company-settings"
import type { CompanySettings } from "@/features/company-settings/db/company-settings"

type UserOption = { id: string; name: string; email: string; role: string }

type Props = {
  settings: CompanySettings | null
  users: UserOption[]
}

const inputStyle = { background: "#f6f6f9", border: "1px solid #e8e8ee", color: "#1c1d2b" } as const

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "G"
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase()
}

export function CompanySettingsForm({ settings, users }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companyUserId, setCompanyUserId] = useState(settings?.companyUserId ?? users[0]?.id ?? "")
  const [name, setName] = useState(settings?.name ?? "")
  const [email, setEmail] = useState(settings?.email ?? "")
  const [phone, setPhone] = useState(settings?.phone ?? "")
  const [address, setAddress] = useState(settings?.address ?? "")

  const selectedUser = users.find((u) => u.id === companyUserId) ?? users[0]

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const fd = new FormData()
      fd.set("companyUserId", companyUserId)
      fd.set("name", name)
      fd.set("email", email)
      fd.set("phone", phone)
      fd.set("address", address)
      const result = await saveCompanySettingsAction(fd)
      if (result?.error) {
        toast.error(result.error)
        setError(result.error)
      } else {
        toast.success("Company settings saved")
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Company account (seller identity for own products) */}
      <div className="rounded-2xl border p-6" style={{ background: "#fff", borderColor: "#ececf1" }}>
        <div className="mb-4 flex items-center gap-[11px]">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-[9px]"
            style={{ background: "#f0edff", color: "#7c5cff" }}
          >
            <User size={17} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[15px] font-semibold" style={{ fontFamily: "Poppins, sans-serif", color: "#1c1d2b" }}>
              Company account
            </div>
            <div className="mt-0.5 text-[12.5px]" style={{ color: "#9499a5" }}>
              The user shown as seller on all company-owned products
            </div>
          </div>
        </div>

        {selectedUser && (
          <div
            className="mb-4 flex items-center gap-3 rounded-xl px-[15px] py-[13px]"
            style={{ background: "#faf9ff", border: "1px solid #efeafe" }}
          >
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
              style={{ background: "#7c5cff" }}
            >
              {getInitials(selectedUser.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-semibold" style={{ color: "#1c1d2b" }}>
                {selectedUser.name}
              </div>
              <div className="truncate text-[12.5px]" style={{ color: "#9499a5" }}>
                {selectedUser.email}
              </div>
            </div>
            <span
              className="shrink-0 rounded-full px-[11px] py-[5px] text-[11px] font-semibold whitespace-nowrap"
              style={{ background: "#efeafe", color: "#7c5cff" }}
            >
              Company seller
            </span>
          </div>
        )}

        <label className="mb-[7px] block text-[12.5px] font-medium" style={{ color: "#6b7280" }}>
          Assign account
        </label>
        <select
          name="companyUserId"
          value={companyUserId}
          onChange={(e) => setCompanyUserId(e.target.value)}
          required
          className="w-full cursor-pointer rounded-[10px] px-[14px] py-3 text-sm focus:outline-none"
          style={inputStyle}
        >
          {users.length === 0 ? (
            <option value="">No internal users found</option>
          ) : (
            users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))
          )}
        </select>
      </div>

      {/* Company information */}
      <div className="rounded-2xl border p-6" style={{ background: "#fff", borderColor: "#ececf1" }}>
        {/* Section header */}
        <div className="mb-5 flex items-center gap-[11px]">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-[9px]"
            style={{ background: "#f0edff", color: "#7c5cff" }}
          >
            <Building2 size={17} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[15px] font-semibold" style={{ fontFamily: "Poppins, sans-serif", color: "#1c1d2b" }}>
              My company information
            </div>
            <div className="mt-0.5 text-[12.5px]" style={{ color: "#9499a5" }}>
              Brand details shown across invoices, receipts and the marketplace
            </div>
          </div>
        </div>

        {/* Logo row */}
        <div
          className="mb-[22px] flex items-center gap-[18px] pb-[22px]"
          style={{ borderBottom: "1px solid #f0f0f4" }}
        >
          <div
            className="flex size-[76px] shrink-0 items-center justify-center overflow-hidden rounded-2xl"
            style={{ background: "#f6f6f9", border: "1px solid #e8e8ee" }}
          >
            <div
              className="flex size-[42px] items-center justify-center rounded-[10px] text-xl font-bold text-white"
              style={{ fontFamily: "Poppins, sans-serif", background: "#7c5cff" }}
            >
              {getInitial(name)}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-[3px] text-sm font-semibold" style={{ fontFamily: "Poppins, sans-serif", color: "#1c1d2b" }}>
              Company logo
            </div>
            <div className="mb-[11px] text-[12.5px]" style={{ color: "#9499a5" }}>
              PNG or SVG, square, at least 256×256px
            </div>
            <div className="flex items-center gap-[9px]">
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center gap-[7px] rounded-[9px] px-[15px] py-[9px] text-[12.5px] font-semibold opacity-60"
                style={{ background: "#f0edff", color: "#7c5cff", border: "none", fontFamily: "Poppins, sans-serif" }}
              >
                Upload logo
              </button>
              <span className="text-[11.5px]" style={{ color: "#c0c4ce" }}>Coming soon</span>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="mb-[7px] block text-[12.5px] font-medium" style={{ color: "#6b7280" }}>
              Company name
            </label>
            <input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-[10px] px-[14px] py-3 text-sm focus:outline-none"
              style={inputStyle}
              placeholder="GemX Marketplace"
            />
          </div>

          <div>
            <label className="mb-[7px] block text-[12.5px] font-medium" style={{ color: "#6b7280" }}>
              Email address
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 flex" style={{ color: "#aeb2bd" }}>
                <Mail size={16} />
              </span>
              <input
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-[10px] py-3 pl-[38px] pr-[14px] text-sm focus:outline-none"
                style={inputStyle}
                placeholder="hello@gemx.market"
              />
            </div>
          </div>

          <div>
            <label className="mb-[7px] block text-[12.5px] font-medium" style={{ color: "#6b7280" }}>
              Phone number
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 flex" style={{ color: "#aeb2bd" }}>
                <Phone size={16} />
              </span>
              <input
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full rounded-[10px] py-3 pl-[38px] pr-[14px] text-sm focus:outline-none"
                style={inputStyle}
                placeholder="+95 9 922 222 222"
              />
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="mb-[7px] block text-[12.5px] font-medium" style={{ color: "#6b7280" }}>
              Address
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-[13px] top-[14px] flex" style={{ color: "#aeb2bd" }}>
                <MapPin size={16} />
              </span>
              <textarea
                name="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                rows={3}
                className="w-full resize-y rounded-[10px] py-3 pl-[38px] pr-[14px] text-sm leading-[1.55] focus:outline-none"
                style={{ minHeight: 74, ...inputStyle }}
                placeholder="No. 123, Bogyoke Aung San Road, Yangon, Myanmar"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.refresh()}
          className="cursor-pointer rounded-[10px] px-5 py-[11px] text-[13.5px] font-medium"
          style={{ background: "#fff", color: "#6b7280", border: "1px solid #e5e5ec", fontFamily: "Poppins, sans-serif" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || users.length === 0}
          className="cursor-pointer rounded-[10px] px-[22px] py-[11px] text-[13.5px] font-medium disabled:opacity-60"
          style={{ background: "#7c5cff", color: "#fff", border: "none", boxShadow: "0 5px 14px rgba(124,92,255,.35)", fontFamily: "Poppins, sans-serif" }}
        >
          {loading ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  )
}

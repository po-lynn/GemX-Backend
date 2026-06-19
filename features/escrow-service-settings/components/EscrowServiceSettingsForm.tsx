"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Shield, Percent, FileText, Smartphone, ChevronLeft } from "lucide-react"
import { toast } from "sonner"
import { saveEscrowServiceSettingsAction } from "@/features/escrow-service-settings/actions/escrow-service-settings"
import type { EscrowServiceSettings } from "@/features/escrow-service-settings/db/escrow-service-settings"

type User = {
  id: string
  name: string
  email: string
  role: string
}

type Props = {
  settings: EscrowServiceSettings | null
  users: User[]
  /** When true, hides the standalone page header — used when embedded in the combined Settings page. */
  embedded?: boolean
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase()
}

function InAppBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 align-middle ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: "#eef1fe", color: "#5566cf" }}
    >
      <Smartphone size={9} strokeWidth={2.2} />
      In app
    </span>
  )
}

const cardStyle = { background: "#fff", borderColor: "#ececf1" } as const
const inputStyle = { background: "#f6f6f9", border: "1px solid #e8e8ee", color: "#1c1d2b" } as const

export function EscrowServiceSettingsForm({ settings, users, embedded = false }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState(settings?.userId ?? users[0]?.id ?? "")
  const [serviceFee, setServiceFee] = useState(settings?.serviceFee ?? "0.00")
  const [serviceOverview, setServiceOverview] = useState(settings?.serviceOverview ?? "")

  const selectedUser = users.find((u) => u.id === userId) ?? users[0]
  const feeNum = parseFloat(String(serviceFee)) || 0
  const feeExample = "$" + ((1000 * feeNum) / 100).toFixed(2)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const fd = new FormData()
      fd.set("userId", userId)
      fd.set("serviceFee", String(serviceFee))
      fd.set("serviceOverview", serviceOverview)
      const result = await saveEscrowServiceSettingsAction(fd)
      if (result?.error) {
        toast.error(result.error)
        setError(result.error)
      } else {
        toast.success("Escrow settings saved")
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
      {!embedded && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-[14px]">
            <button
              type="button"
              onClick={() => router.back()}
              className="mt-0.5 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border text-muted-foreground hover:bg-muted/50"
              aria-label="Back"
            >
              <ChevronLeft size={18} />
            </button>
            <div>
              <h1 className="text-[25px] font-semibold leading-tight tracking-tight" style={{ color: "#1c1d2b" }}>
                Escrow Service Settings
              </h1>
              <p className="mt-1 text-sm" style={{ color: "#8a8f9c" }}>
                Assign the officer who manages escrow transactions between buyers and sellers.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="cursor-pointer rounded-[10px] px-5 py-[11px] text-[13.5px] font-medium"
              style={{ background: "#fff", color: "#6b7280", border: "1px solid #e5e5ec" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || users.length === 0}
              className="cursor-pointer rounded-[10px] px-[22px] py-[11px] text-[13.5px] font-medium disabled:opacity-60"
              style={{ background: "#7c5cff", color: "#fff", border: "none", boxShadow: "0 5px 14px rgba(124,92,255,.35)" }}
            >
              {loading ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Escrow service officer */}
      <div className="rounded-2xl border p-6" style={cardStyle}>
        <div className="mb-4 flex items-center gap-[11px]">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-[9px]"
            style={{ background: "#f0edff", color: "#7c5cff" }}
          >
            <Shield size={17} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[15px] font-semibold" style={{ color: "#1c1d2b" }}>
              Escrow service officer
              <InAppBadge />
            </div>
            <div className="mt-0.5 text-[12.5px]" style={{ color: "#9499a5" }}>
              Handles transactions and replies to buyer &amp; seller chats
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
              Assigned officer
            </span>
          </div>
        )}

        <label
          htmlFor="userId"
          className="mb-[7px] block text-[12.5px] font-medium"
          style={{ color: "#6b7280" }}
        >
          Assign officer
        </label>
        <select
          id="userId"
          name="userId"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
          className="w-full cursor-pointer rounded-[10px] px-[14px] py-3 text-sm focus:outline-none"
          style={inputStyle}
        >
          {users.length === 0 ? (
            <option value="">No users found</option>
          ) : (
            users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))
          )}
        </select>
      </div>

      {/* Service fee */}
      <div className="rounded-2xl border p-6" style={cardStyle}>
        <div className="mb-[18px] flex items-center gap-[11px]">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-[9px]"
            style={{ background: "#fdf2e7", color: "#e08b1a" }}
          >
            <Percent size={17} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[15px] font-semibold" style={{ color: "#1c1d2b" }}>
              Service fee
              <InAppBadge />
            </div>
            <div className="mt-0.5 text-[12.5px]" style={{ color: "#9499a5" }}>
              Flat percentage charged on each transaction
            </div>
          </div>
        </div>
        <div className="flex items-end gap-[14px]">
          <div className="relative w-[200px]">
            <input
              id="serviceFee"
              name="serviceFee"
              type="number"
              step="0.01"
              min={0}
              value={serviceFee}
              onChange={(e) => setServiceFee(e.target.value)}
              required
              className="w-full rounded-[10px] py-3 pl-[14px] pr-[38px] text-base font-semibold focus:outline-none"
              style={inputStyle}
            />
            <span
              className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 font-semibold"
              style={{ color: "#9499a5" }}
            >
              %
            </span>
          </div>
          <div className="pb-3 text-[12.5px]" style={{ color: "#a3a7b3" }}>
            e.g. a $1,000 trade is charged {feeExample}
          </div>
        </div>
      </div>

      {/* Service overview */}
      <div className="rounded-2xl border p-6" style={cardStyle}>
        <div className="mb-[14px] flex items-center gap-[11px]">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-[9px]"
            style={{ background: "#e9eefc", color: "#3a6df0" }}
          >
            <FileText size={17} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[15px] font-semibold" style={{ color: "#1c1d2b" }}>
              Service overview
              <InAppBadge />
            </div>
            <div className="mt-0.5 text-[12.5px]" style={{ color: "#9499a5" }}>
              Shown to buyers and sellers before they opt in
            </div>
          </div>
        </div>
        <textarea
          id="serviceOverview"
          name="serviceOverview"
          value={serviceOverview}
          onChange={(e) => setServiceOverview(e.target.value)}
          maxLength={5000}
          placeholder="Describe the escrow service for users..."
          className="w-full resize-y rounded-[11px] px-[14px] py-[13px] text-[13.5px] leading-[1.55] focus:outline-none"
          style={{ minHeight: 104, ...inputStyle }}
        />
      </div>

      {embedded && (
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
      )}
    </form>
  )
}

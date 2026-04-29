"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { saveEscrowServiceSettingsAction } from "@/features/escrow-service-settings/actions/escrow-service-settings"
import type { EscrowServiceSettings } from "@/features/escrow-service-settings/db/escrow-service-settings"

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"

type Props = {
  settings: EscrowServiceSettings | null
  users: Array<{
    id: string
    name: string
    role: string
  }>
}

export function EscrowServiceSettingsForm({ settings, users }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState(settings?.userId ?? users[0]?.id ?? "")
  const [serviceFee, setServiceFee] = useState(settings?.serviceFee ?? "0.00")
  const [serviceOverview, setServiceOverview] = useState(settings?.serviceOverview ?? "")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const fd = new FormData()
      fd.set("userId", userId)
      fd.set("serviceFee", serviceFee)
      fd.set("serviceOverview", serviceOverview)

      const result = await saveEscrowServiceSettingsAction(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-6">
        <h2 className="text-lg font-semibold">Escrow Service Settings</h2>
        <div className="space-y-2">
          <label htmlFor="userId" className="text-sm font-medium">
            Escrow Service Admin
          </label>
          <select
            id="userId"
            name="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className={inputClass}
            required
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
        <div className="space-y-2">
          <label htmlFor="serviceFee" className="text-sm font-medium">
            Service Fee
          </label>
          <input
            id="serviceFee"
            name="serviceFee"
            type="number"
            step="0.01"
            min={0}
            value={serviceFee}
            onChange={(e) => setServiceFee(e.target.value)}
            className={inputClass}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="serviceOverview" className="text-sm font-medium">
            Service Overview
          </label>
          <textarea
            id="serviceOverview"
            name="serviceOverview"
            value={serviceOverview}
            onChange={(e) => setServiceOverview(e.target.value)}
            className={`${inputClass} min-h-28 py-2`}
            maxLength={5000}
            placeholder="Describe the escrow service for users..."
          />
        </div>
      </div>

      <div>
        <Button type="submit" disabled={loading || users.length === 0}>
          {loading ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </form>
  )
}


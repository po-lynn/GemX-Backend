"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { adminCreatePointPurchaseRequestAction } from "@/features/points/actions/points"
import type { PointPurchasePackage, PaymentMethod } from "@/features/points/db/points"

type UserOption = {
  id: string
  name: string | null
  email: string
  phone: string | null
  points: number
}

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "9px 12px",
  border: "1px solid var(--lv-border)",
  borderRadius: 8,
  outline: "none",
  width: "100%",
  background: "#fff",
  color: "var(--lv-text)",
}

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function getHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
  return h % 360
}

export function AdminCreatePurchaseRequestDialog({
  users,
  pointPackages,
  paymentMethods,
}: {
  users: UserOption[]
  pointPackages: PointPurchasePackage[]
  paymentMethods: PaymentMethod[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const [query, setQuery] = useState("")
  const [showList, setShowList] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null)
  const [packageName, setPackageName] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [transferredAmount, setTransferredAmount] = useState("")
  const [transferredName, setTransferredName] = useState("")
  const [transactionReference, setTransactionReference] = useState("")
  const [transferNote, setTransferNote] = useState("")

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return users.slice(0, 8)
    return users
      .filter(
        (u) =>
          (u.name ?? "").toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone ?? "").includes(q)
      )
      .slice(0, 8)
  }, [query, users])

  const selectedPackage = pointPackages.find((p) => p.name === packageName)

  function reset() {
    setQuery("")
    setSelectedUser(null)
    setPackageName("")
    setPaymentMethod("")
    setTransferredAmount("")
    setTransferredName("")
    setTransactionReference("")
    setTransferNote("")
    setError(null)
    setShowList(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser || !packageName || !paymentMethod || !selectedPackage) {
      setError("Please fill in all required fields.")
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set("userId", selectedUser.id)
      fd.set("packageName", packageName)
      fd.set("points", String(selectedPackage.points + (selectedPackage.bonus ?? 0)))
      fd.set("price", String(selectedPackage.priceMmk ?? 0))
      fd.set("currency", "mmk")
      fd.set("paymentMethod", paymentMethod)
      if (transferredAmount) fd.set("transferredAmount", transferredAmount)
      if (transferredName) fd.set("transferredName", transferredName)
      if (transactionReference) fd.set("transactionReference", transactionReference)
      if (transferNote) fd.set("transferNote", transferNote)

      const result = await adminCreatePointPurchaseRequestAction(fd)
      if (result?.error) {
        setError(result.error)
      } else {
        setOpen(false)
        reset()
        startTransition(() => router.refresh())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button size="sm" className="shrink-0 shadow-sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-4" />
        Create Request
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!submitting && !v) {
            setOpen(false)
            reset()
          }
        }}
      >
        <DialogContent style={{ maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle className="text-base">Create Payment Transaction</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--lv-text-2)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                User *
              </label>
              <div style={{ position: "relative" }}>
                <Search
                  style={{
                    position: "absolute",
                    left: 11,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 14,
                    height: 14,
                    color: "var(--lv-text-3)",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search by name, email or phone…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setShowList(true)
                    setSelectedUser(null)
                  }}
                  onFocus={() => setShowList(true)}
                  onBlur={() => setTimeout(() => setShowList(false), 150)}
                  style={{ ...inputStyle, paddingLeft: 34 }}
                  autoComplete="off"
                />
                {showList && filtered.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      background: "#fff",
                      border: "1px solid var(--lv-border)",
                      borderRadius: 10,
                      boxShadow: "var(--lv-shadow-pop)",
                      overflow: "hidden",
                    }}
                  >
                    {filtered.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={() => {
                          setSelectedUser(u)
                          setQuery(u.name ?? u.email)
                          setShowList(false)
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span
                          className="lv-avatar"
                          data-hue={getHue(u.id)}
                          style={{ width: 30, height: 30, fontSize: 11, flexShrink: 0 }}
                        >
                          {getInitials(u.name)}
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--lv-text)" }}>
                            {u.name}
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--lv-text-3)" }}>
                            {u.email}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--lv-text-2)", fontWeight: 600 }}>
                          {u.points.toLocaleString()} pts
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--lv-text-2)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Point Package *
              </label>
              <select
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                style={inputStyle}
                required
              >
                <option value="">Select a package…</option>
                {pointPackages
                  .filter((p) => p.enabled !== false)
                  .map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} — {p.points}
                      {p.bonus ? ` +${p.bonus}` : ""} pts
                      {p.priceMmk ? ` (${p.priceMmk.toLocaleString()} MMK)` : ""}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--lv-text-2)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={inputStyle}
                required
              >
                <option value="">Select a method…</option>
                {paymentMethods
                  .filter((m) => m.enabled !== false)
                  .map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--lv-text-2)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Transferred Amount
                </label>
                <input
                  type="number"
                  value={transferredAmount}
                  onChange={(e) => setTransferredAmount(e.target.value)}
                  placeholder="e.g. 25000"
                  style={inputStyle}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--lv-text-2)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Transfer Name
                </label>
                <input
                  type="text"
                  value={transferredName}
                  onChange={(e) => setTransferredName(e.target.value)}
                  placeholder="Name on transfer"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--lv-text-2)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Transaction Reference
              </label>
              <input
                type="text"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                placeholder="Receipt or reference number"
                style={inputStyle}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--lv-text-2)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Note
              </label>
              <textarea
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="Optional note"
                style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
              />
            </div>

            {error && (
              <p
                style={{
                  fontSize: 13,
                  color: "#dc2626",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "8px 12px",
                  margin: 0,
                }}
              >
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || !selectedUser || !packageName || !paymentMethod}
              >
                {submitting ? "Creating…" : "Create Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

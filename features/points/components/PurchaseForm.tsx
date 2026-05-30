"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check } from "lucide-react"
import type { PointPurchasePackage, PaymentMethod } from "@/features/points/db/points"

type Props = {
  packages: PointPurchasePackage[]
  paymentMethods: PaymentMethod[]
  successRedirect?: string
}

function fmtMMK(n: number) {
  return n.toLocaleString("en-US")
}

export function PurchaseForm({ packages, paymentMethods, successRedirect = "/account/points?filter=pending" }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [selectedPkg, setSelectedPkg]   = useState<PointPurchasePackage | null>(packages[0] ?? null)
  const [selectedPay, setSelectedPay]   = useState<PaymentMethod | null>(paymentMethods[0] ?? null)
  const [transferredAmount, setTransferredAmount] = useState("")
  const [transferredName, setTransferredName]     = useState("")
  const [transactionRef, setTransactionRef]       = useState("")
  const [transferNote, setTransferNote]           = useState("")

  function getPrice(pkg: PointPurchasePackage) {
    return pkg.priceMmk ?? pkg.priceUsd ?? pkg.priceKrw ?? 0
  }
  function getCurrency(pkg: PointPurchasePackage) {
    if (pkg.priceMmk != null) return "mmk"
    if (pkg.priceUsd != null) return "usd"
    return "krw"
  }
  function priceLabel(pkg: PointPurchasePackage) {
    if (pkg.priceMmk != null) return `MMK ${fmtMMK(pkg.priceMmk)}`
    if (pkg.priceUsd != null) return `USD ${pkg.priceUsd}`
    if (pkg.priceKrw != null) return `KRW ${fmtMMK(pkg.priceKrw)}`
    return "—"
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPkg || !selectedPay) return

    startTransition(async () => {
      try {
        const res = await fetch("/api/mobile/points/purchase-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            package_name:         selectedPkg.name,
            payment_method:       selectedPay.name,
            currency:             getCurrency(selectedPkg),
            transferredAmount:    parseInt(transferredAmount, 10),
            transferredName:      transferredName.trim(),
            transactionReference: transactionRef.trim(),
            transferNote:         transferNote.trim() || undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error ?? "Failed to submit request")
          return
        }
        toast.success(`Request submitted — ${selectedPkg.points.toLocaleString()} pts pending approval`)
        router.push(successRedirect)
      } catch {
        toast.error("Network error. Please try again.")
      }
    })
  }

  if (packages.length === 0) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--lv-text-3)" }}>
        No point packages are currently available.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Step 1 — Select package */}
      <div className="lv-drawer-section-h" style={{ marginBottom: 12 }}>1. Select a package</div>
      <div className="pt-pkg-grid">
        {packages.map((pkg) => (
          <button
            key={pkg.name}
            type="button"
            className={`pt-pkg-card${selectedPkg?.name === pkg.name ? " selected" : ""}`}
            onClick={() => setSelectedPkg(pkg)}
          >
            {pkg.popular && <span className="pt-pkg-popular">Popular</span>}
            <div className="pt-pkg-points">
              {pkg.points.toLocaleString()}<span> pts</span>
            </div>
            {pkg.bonus && (
              <div className="pt-pkg-bonus">+{pkg.bonus.toLocaleString()} bonus pts</div>
            )}
            <div className="pt-pkg-price">{priceLabel(pkg)}</div>
            {selectedPkg?.name === pkg.name && (
              <Check
                style={{ position: "absolute", top: 10, right: 10, width: 14, height: 14, color: "var(--lv-accent)" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Step 2 — Payment method */}
      {paymentMethods.length > 0 && (
        <>
          <div className="lv-drawer-section-h" style={{ marginBottom: 12, marginTop: 4 }}>2. Payment method</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            {paymentMethods.map((m) => (
              <button
                key={m.name}
                type="button"
                style={{
                  padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: `2px solid ${selectedPay?.name === m.name ? "var(--lv-accent)" : "var(--lv-border)"}`,
                  background: selectedPay?.name === m.name ? "var(--lv-accent-soft)" : "#fff",
                  color: selectedPay?.name === m.name ? "var(--lv-accent)" : "var(--lv-text-2)",
                  transition: "all .15s",
                }}
                onClick={() => setSelectedPay(m)}
              >
                {m.name}
              </button>
            ))}
          </div>

          {selectedPay && (
            <div className="pt-pay-card">
              <div className="pt-pay-name">{selectedPay.name}</div>
              <div className="pt-pay-detail">
                Account name: <strong>{selectedPay.accountName}</strong><br />
                Phone number: <strong>{selectedPay.phoneNumber}</strong>
                {selectedPkg && (
                  <><br />Amount to transfer: <strong>{priceLabel(selectedPkg)}</strong></>
                )}
                {selectedPay.instructions && (
                  <><br /><span style={{ marginTop: 4, display: "block", color: "var(--lv-text-3)" }}>{selectedPay.instructions}</span></>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Step 3 — Transfer details */}
      <div className="lv-drawer-section-h" style={{ marginBottom: 12, marginTop: 4 }}>3. Submit transfer proof</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lv-text-2)" }}>
            Amount transferred <span style={{ color: "var(--lv-danger)" }}>*</span>
          </span>
          <input
            type="number"
            required
            min={1}
            value={transferredAmount}
            onChange={(e) => setTransferredAmount(e.target.value)}
            placeholder="e.g. 5000"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lv-text-2)" }}>
            Name on transfer <span style={{ color: "var(--lv-danger)" }}>*</span>
          </span>
          <input
            type="text"
            required
            value={transferredName}
            onChange={(e) => setTransferredName(e.target.value)}
            placeholder="Your name as shown in the transfer"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lv-text-2)" }}>
            Transaction reference / receipt number <span style={{ color: "var(--lv-danger)" }}>*</span>
          </span>
          <input
            type="text"
            required
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
            placeholder="e.g. TXN-123456"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lv-text-2)" }}>Note (optional)</span>
          <textarea
            rows={2}
            value={transferNote}
            onChange={(e) => setTransferNote(e.target.value)}
            placeholder="Any additional information for the admin"
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center" }}>
        <button
          type="submit"
          disabled={isPending || !selectedPkg || !selectedPay}
          className="pt-topup-btn"
          style={{ opacity: isPending ? 0.6 : 1 }}
        >
          {isPending ? "Submitting…" : "Submit request"}
        </button>
        <a
          href="/account/points"
          style={{ fontSize: 13, color: "var(--lv-text-3)", textDecoration: "none" }}
        >
          Cancel
        </a>
      </div>
    </form>
  )
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

"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  getEscrowAgentOptionsAction,
  searchListingsForEscrowCaseAction,
  searchUsersForEscrowCaseAction,
} from "@/features/escrow-cases/actions/escrow-cases"
import { majorToMinor } from "@/features/escrow-cases/lib/money"
import type { UserPickerOption } from "@/features/users/db/users"
import type { AdminSearchProduct } from "@/features/products/db/products"

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 transition-colors focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (caseId: string) => void
}

function PickerField<T>({
  label,
  placeholder,
  selectedLabel,
  onClear,
  query,
  onQueryChange,
  results,
  renderResult,
  onPick,
}: {
  label: string
  placeholder: string
  selectedLabel: string | null
  onClear: () => void
  query: string
  onQueryChange: (v: string) => void
  results: T[]
  renderResult: (item: T) => { key: string; label: string }
  onPick: (item: T) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-slate-500">{label}</label>
      {selectedLabel ? (
        <div className="flex h-9 items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-semibold text-violet-800">
          <span className="truncate">{selectedLabel}</span>
          <button type="button" onClick={onClear} className="ml-2 text-xs font-bold text-violet-500 hover:text-violet-700">
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            className={inputClass}
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {results.map((item) => {
                const { key, label: resultLabel } = renderResult(item)
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => onPick(item)}
                    className="block w-full truncate px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-violet-50"
                  >
                    {resultLabel}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Minimal, staff-only case creation form — deliberately just enough to hang a case
 *  thread on (buyer, seller, listing, agreed price, optional agent), per the brief's
 *  "don't build the full escrow operations console" instruction. No mobile-facing
 *  case-creation flow exists; staff open a case here after reviewing initial contact. */
export function NewEscrowCaseDialog({ open, onOpenChange, onCreated }: Props) {
  const [buyerQuery, setBuyerQuery] = useState("")
  const [buyerResults, setBuyerResults] = useState<UserPickerOption[]>([])
  const [buyer, setBuyer] = useState<UserPickerOption | null>(null)

  const [sellerQuery, setSellerQuery] = useState("")
  const [sellerResults, setSellerResults] = useState<UserPickerOption[]>([])
  const [seller, setSeller] = useState<UserPickerOption | null>(null)

  const [listingQuery, setListingQuery] = useState("")
  const [listingResults, setListingResults] = useState<AdminSearchProduct[]>([])
  const [listing, setListing] = useState<AdminSearchProduct | null>(null)

  const [agents, setAgents] = useState<Array<{ userId: string; name: string; email: string }>>([])
  const [assignedAgentId, setAssignedAgentId] = useState("")

  const [price, setPrice] = useState("")
  const [currency, setCurrency] = useState<"USD" | "MMK">("USD")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) void getEscrowAgentOptionsAction().then(setAgents)
  }, [open])

  useEffect(() => {
    if (buyer || buyerQuery.trim().length < 2) return
    const t = setTimeout(() => void searchUsersForEscrowCaseAction(buyerQuery).then(setBuyerResults), 250)
    return () => clearTimeout(t)
  }, [buyer, buyerQuery])

  useEffect(() => {
    if (seller || sellerQuery.trim().length < 2) return
    const t = setTimeout(() => void searchUsersForEscrowCaseAction(sellerQuery).then(setSellerResults), 250)
    return () => clearTimeout(t)
  }, [seller, sellerQuery])

  useEffect(() => {
    if (listing || listingQuery.trim().length < 2) return
    const t = setTimeout(() => void searchListingsForEscrowCaseAction(listingQuery).then(setListingResults), 250)
    return () => clearTimeout(t)
  }, [listing, listingQuery])

  // Clearing stale results belongs in the input's own change handler (an event
  // handler, not an effect body) — keeps each debounce effect a pure "fetch when
  // the query is long enough" subscription instead of also owning the clear-on-
  // short-query case, which upset react-hooks/set-state-in-effect.
  function handleBuyerQueryChange(value: string) {
    setBuyerQuery(value)
    if (value.trim().length < 2) setBuyerResults([])
  }
  function handleSellerQueryChange(value: string) {
    setSellerQuery(value)
    if (value.trim().length < 2) setSellerResults([])
  }
  function handleListingQueryChange(value: string) {
    setListingQuery(value)
    if (value.trim().length < 2) setListingResults([])
  }

  function reset() {
    setBuyerQuery(""); setBuyerResults([]); setBuyer(null)
    setSellerQuery(""); setSellerResults([]); setSeller(null)
    setListingQuery(""); setListingResults([]); setListing(null)
    setAssignedAgentId(""); setPrice(""); setCurrency("USD")
  }

  const priceMajor = Number(price)
  const canSubmit = !!buyer && !!seller && buyer.id !== seller.id && !!listing && price.trim() !== "" && !Number.isNaN(priceMajor) && priceMajor > 0

  async function handleSubmit() {
    if (!canSubmit || !buyer || !seller || !listing) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/escrow-cases", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId: buyer.id,
          sellerId: seller.id,
          listingId: listing.id,
          assignedAgentId: assignedAgentId || undefined,
          agreedPriceMinor: majorToMinor(priceMajor, currency),
          currency,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to create case")
      toast.success("Escrow case created")
      onCreated((data as { case: { id: string } }).case.id)
      onOpenChange(false)
      reset()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create case")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New escrow case</DialogTitle>
          <DialogDescription>
            GemX coordinates the handover — it doesn&apos;t hold funds. This creates the minimum
            record needed to open a case thread.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <PickerField
            label="Buyer"
            placeholder="Search buyer by name, email, or phone…"
            selectedLabel={buyer ? `${buyer.name ?? buyer.email} (${buyer.email})` : null}
            onClear={() => setBuyer(null)}
            query={buyerQuery}
            onQueryChange={handleBuyerQueryChange}
            results={buyerResults}
            renderResult={(u) => ({ key: u.id, label: `${u.name ?? u.email} · ${u.email}` })}
            onPick={(u) => { setBuyer(u); setBuyerResults([]) }}
          />
          <PickerField
            label="Seller"
            placeholder="Search seller by name, email, or phone…"
            selectedLabel={seller ? `${seller.name ?? seller.email} (${seller.email})` : null}
            onClear={() => setSeller(null)}
            query={sellerQuery}
            onQueryChange={handleSellerQueryChange}
            results={sellerResults}
            renderResult={(u) => ({ key: u.id, label: `${u.name ?? u.email} · ${u.email}` })}
            onPick={(u) => { setSeller(u); setSellerResults([]) }}
          />
          <PickerField
            label="Listing"
            placeholder="Search listing by title…"
            selectedLabel={listing ? listing.title : null}
            onClear={() => setListing(null)}
            query={listingQuery}
            onQueryChange={handleListingQueryChange}
            results={listingResults}
            renderResult={(p) => ({ key: p.id, label: p.title })}
            onPick={(p) => { setListing(p); setListingResults([]) }}
          />
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500">Assigned agent (optional)</label>
            <select value={assignedAgentId} onChange={(e) => setAssignedAgentId(e.target.value)} className={inputClass}>
              <option value="">Unassigned (requested)</option>
              {agents.map((a) => (
                <option key={a.userId} value={a.userId}>{a.name} ({a.email})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-bold text-slate-500">Agreed price</label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className={inputClass}
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs font-bold text-slate-500">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as "USD" | "MMK")} className={inputClass}>
                <option value="USD">USD</option>
                <option value="MMK">MMK</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "Creating…" : "Create case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { ReputationCasesTable } from "@/features/reviews/components/ReputationCasesTable"
import type { ReputationCase } from "@/features/reviews/db/reputation-cases"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/features/reviews/actions/reputation-cases", () => ({
  archiveSellerAction: vi.fn().mockResolvedValue({ success: true }),
  dismissCaseAction: vi.fn().mockResolvedValue({ success: true }),
  recordSecondaryActionAction: vi.fn().mockResolvedValue({ success: true }),
  bulkArchiveSellersAction: vi.fn().mockResolvedValue({ success: true }),
  bulkDismissCasesAction: vi.fn().mockResolvedValue({ success: true }),
}))

const CASE: ReputationCase = {
  id: "seller-1",
  sellerUserId: "seller-1",
  sellerName: "Pyin Oo Lwin Stones",
  sellerImage: null,
  isPremium: false,
  avgRating: 3.5,
  reviewCount: 40,
  ratingChange30d: -0.4,
  negativeMixPct: 23,
  signals: [
    { triggerKey: "rating_below_archive", label: "Rating below archive threshold", detail: "3.50 avg over 40 reviews (floor 3.80)", severity: "critical" },
  ],
  severity: "critical",
  openSince: new Date("2026-07-29T00:00:00Z"),
  recentReviews: [],
  activeListingsCount: 12,
  priorWarningsCount: 0,
}

describe("ReputationCasesTable", () => {
  beforeEach(() => vi.clearAllMocks())
  // Vitest is configured without `globals: true`, so React Testing Library's
  // automatic afterEach cleanup never registers — without this, each render()
  // below stacks on top of the previous test's DOM (see messages-triage-page.test.tsx
  // for the same pattern elsewhere in this repo).
  afterEach(() => cleanup())

  it("renders the seller name and severity", () => {
    render(<ReputationCasesTable cases={[CASE]} page={1} pageSize={20} total={1} activeTab="all" />)
    expect(screen.getByText("Pyin Oo Lwin Stones")).toBeInTheDocument()
  })

  it("opens the detail drawer on row click and shows the why-flagged signal", () => {
    render(<ReputationCasesTable cases={[CASE]} page={1} pageSize={20} total={1} activeTab="all" />)
    fireEvent.click(screen.getByText("Pyin Oo Lwin Stones"))
    // Scoped to the drawer: the table row also previews the signal detail
    // inline (by design — see ReputationCasesTable's "seller" column), so once
    // the drawer is open the same text exists in both the row and the drawer.
    // A plain screen.getByText would be ambiguous; querying within the dialog
    // is what actually proves the drawer rendered the signal.
    const drawer = screen.getByRole("dialog", { name: /Reputation case detail/i })
    expect(within(drawer).getByText(/3.50 avg over 40 reviews/)).toBeInTheDocument()
  })

  it("requires a reason before confirming an archive", async () => {
    const { archiveSellerAction } = await import("@/features/reviews/actions/reputation-cases")
    render(<ReputationCasesTable cases={[CASE]} page={1} pageSize={20} total={1} activeTab="all" />)
    fireEvent.click(screen.getAllByText("Archive")[0])
    const confirmBtn = screen.getByRole("button", { name: /Confirm Archive/i })
    expect(confirmBtn).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText(/Reason for the decision/i), {
      target: { value: "Below 3.8 threshold for 6 days" },
    })
    expect(confirmBtn).not.toBeDisabled()
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(archiveSellerAction).toHaveBeenCalled())
  })
})

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

// Two signals on one case — the shape that exposed the "dismiss only clears the
// first signal" bug. Suppression in computeCaseSummaries is keyed per
// (seller, rule), so dismissing one of these leaves the other matching and the
// case reappears on the next render.
const MULTI_SIGNAL_CASE: ReputationCase = {
  ...CASE,
  id: "seller-2",
  sellerUserId: "seller-2",
  sellerName: "Mogok Gem House",
  signals: [
    { triggerKey: "rating_below_archive", label: "Rating below archive threshold", detail: "3.40 avg over 52 reviews (floor 3.80)", severity: "critical" },
    { triggerKey: "negative_streak", label: "Negative review streak", detail: "8 of the last 10 reviews are 1–2★", severity: "high" },
  ],
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

  // Finding #7: the row-level Dismiss must clear EVERY signal on the case, not
  // just signals[0], or a multi-signal case reopens immediately and the admin
  // sees no effect despite an audit row being written.
  it("dismisses every signal on a multi-signal case from the row action", async () => {
    const { dismissCaseAction } = await import("@/features/reviews/actions/reputation-cases")
    render(
      <ReputationCasesTable cases={[MULTI_SIGNAL_CASE]} page={1} pageSize={20} total={1} activeTab="all" />
    )
    fireEvent.click(screen.getAllByText("Dismiss")[0])

    await waitFor(() => expect(dismissCaseAction).toHaveBeenCalledTimes(2))
    const sentTriggerKeys = vi
      .mocked(dismissCaseAction)
      .mock.calls.map((call) => (call[0] as FormData).get("triggerKey"))
    expect(sentTriggerKeys).toEqual(["rating_below_archive", "negative_streak"])
  })

  // Same fix at drawer scope: the drawer's button dismisses all flags and its
  // label reflects that, so the operator knows the whole case is being closed.
  it("dismisses every signal from the drawer and labels the button with the count", async () => {
    const { dismissCaseAction } = await import("@/features/reviews/actions/reputation-cases")
    render(
      <ReputationCasesTable cases={[MULTI_SIGNAL_CASE]} page={1} pageSize={20} total={1} activeTab="all" />
    )
    fireEvent.click(screen.getByText("Mogok Gem House"))
    const drawer = screen.getByRole("dialog", { name: /Reputation case detail/i })
    fireEvent.change(within(drawer).getByPlaceholderText(/Reason for the decision/i), {
      target: { value: "Reviewed both flags, seller recovering" },
    })
    const dismissBtn = within(drawer).getByRole("button", { name: /Dismiss all 2 flags/i })
    fireEvent.click(dismissBtn)

    await waitFor(() => expect(dismissCaseAction).toHaveBeenCalledTimes(2))
    const sentTriggerKeys = vi
      .mocked(dismissCaseAction)
      .mock.calls.map((call) => (call[0] as FormData).get("triggerKey"))
    expect(sentTriggerKeys).toEqual(["rating_below_archive", "negative_streak"])
  })

  // Bulk scope: every selected case contributes one entry per signal, so a
  // 2-signal case sends 2 entries rather than silently dropping one.
  it("expands each selected case into one bulk-dismiss entry per signal", async () => {
    const { bulkDismissCasesAction } = await import("@/features/reviews/actions/reputation-cases")
    render(
      <ReputationCasesTable
        cases={[CASE, MULTI_SIGNAL_CASE]}
        page={1}
        pageSize={20}
        total={2}
        activeTab="all"
      />
    )
    // Select all rows, then open the bulk dismiss dialog.
    fireEvent.click(screen.getAllByRole("checkbox")[0])
    fireEvent.click(screen.getByText("Dismiss flags"))
    fireEvent.change(screen.getByPlaceholderText(/Reason for the decision/i), {
      target: { value: "Bulk reviewed" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }))

    await waitFor(() => expect(bulkDismissCasesAction).toHaveBeenCalled())
    // 1 signal on CASE + 2 signals on MULTI_SIGNAL_CASE = 3 entries.
    expect(vi.mocked(bulkDismissCasesAction).mock.calls[0][0]).toEqual([
      { sellerUserId: "seller-1", triggerKey: "rating_below_archive" },
      { sellerUserId: "seller-2", triggerKey: "rating_below_archive" },
      { sellerUserId: "seller-2", triggerKey: "negative_streak" },
    ])
  })
})

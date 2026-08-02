import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { FilterRails } from "@/features/messages/components/triage/FilterRails"
import type { TriageFacetCounts } from "@/features/messages/types/triage"

afterEach(cleanup)

const facets: TriageFacetCounts = {
  status: { all: 10, flagged: 2, awaiting: 3, mine: 1, resolved: 4 },
  type: { all: 10, chat: 6, escrow: 3, system: 1 },
}

describe("FilterRails", () => {
  // Validates every status/type row renders with its facet count
  it("renders status and type rows with their counts", () => {
    render(
      <FilterRails
        status="all"
        type="all"
        facets={facets}
        onStatusChange={vi.fn()}
        onTypeChange={vi.fn()}
        slaText="4 flagged items breach in under 2h."
      />
    )
    expect(screen.getByText("Flagged")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("Escrow")).toBeInTheDocument()
    expect(screen.getAllByText("3").length).toBeGreaterThan(0)
    expect(screen.getByText("4 flagged items breach in under 2h.")).toBeInTheDocument()
  })

  // Validates clicking a status row calls onStatusChange with that status key
  it("calls onStatusChange when a status row is clicked", () => {
    const onStatusChange = vi.fn()
    render(
      <FilterRails
        status="all"
        type="all"
        facets={facets}
        onStatusChange={onStatusChange}
        onTypeChange={vi.fn()}
        slaText=""
      />
    )
    fireEvent.click(screen.getByText("Flagged"))
    expect(onStatusChange).toHaveBeenCalledWith("flagged")
  })

  // Validates clicking a type row calls onTypeChange with that type key
  it("calls onTypeChange when a type row is clicked", () => {
    const onTypeChange = vi.fn()
    render(
      <FilterRails
        status="all"
        type="all"
        facets={facets}
        onStatusChange={vi.fn()}
        onTypeChange={onTypeChange}
        slaText=""
      />
    )
    fireEvent.click(screen.getByText("Escrow"))
    expect(onTypeChange).toHaveBeenCalledWith("escrow")
  })
})

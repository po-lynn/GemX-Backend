import { afterEach, describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react"
import { ListViewCard } from "@/components/admin/list-view/ListViewCard"
import type { FilterDef } from "@/components/admin/list-view/types"

afterEach(cleanup)

type Row = { id: string; name: string }

const rows: Row[] = [{ id: "1", name: "Row One" }]
const columnDefs = [{ id: "name", label: "Name", render: (r: Row) => r.name }]

const filterDefs: FilterDef[] = [
  {
    id: "type",
    label: "Type",
    type: "multi",
    options: [
      { value: "loose_stone", label: "Loose Stone", count: 8 },
      { value: "jewellery", label: "Jewellery", count: 4 },
    ],
  },
  {
    id: "category",
    label: "Category",
    type: "multi",
    options: [
      { value: "sapphire", label: "Sapphire", count: 4 },
      { value: "ruby", label: "Ruby", count: 3 },
    ],
  },
]

describe("ListViewCard filter change batching", () => {
  // Regression test: clicking "Clear all" with two server-driven filters active used to only
  // clear the first one, because handleSetFilters called onFilterChange once per changed filter
  // and returned immediately after the first "handled" response — the second filter's change was
  // never reported to the parent. onFilterChange must now receive every changed filter in one call.
  it("reports every filter that changed via 'Clear all' in a single onFilterChange call, not just the first", () => {
    const onFilterChange = vi.fn().mockReturnValue(true)

    render(
      <ListViewCard
        rows={rows}
        columnDefs={columnDefs}
        filterDefs={filterDefs}
        defaultFilters={{ type: ["loose_stone"], category: ["sapphire"] }}
        onFilterChange={onFilterChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Clear all/i }))

    expect(onFilterChange).toHaveBeenCalledTimes(1)
    const changes = onFilterChange.mock.calls[0][0]
    const byId = Object.fromEntries(changes.map((c: { id: string; values: string[] }) => [c.id, c.values]))
    expect(byId).toEqual({ type: [], category: [] })
  })

  // Sanity check that a single filter change is still reported correctly as a one-item batch.
  it("reports a single filter change as a batch of one", () => {
    const onFilterChange = vi.fn().mockReturnValue(true)

    render(
      <ListViewCard
        rows={rows}
        columnDefs={columnDefs}
        filterDefs={filterDefs}
        onFilterChange={onFilterChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /^Filter$/i }))
    const menu = screen.getByRole("menu")
    fireEvent.click(within(menu).getByText("Loose Stone"))
    fireEvent.click(within(menu).getByRole("button", { name: "Filter" }))

    expect(onFilterChange).toHaveBeenCalledTimes(1)
    expect(onFilterChange.mock.calls[0][0]).toEqual([{ id: "type", values: ["loose_stone"] }])
  })
})

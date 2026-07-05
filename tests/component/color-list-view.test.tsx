import { afterEach, describe, it, expect, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { ColorListView } from "@/features/colors/components/ColorListView"
import type { ColorOption } from "@/features/colors/db/color"

afterEach(cleanup)

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

type MockListViewProps = {
  rows: ColorOption[]
  columnDefs: Array<{ id: string; render: (r: ColorOption) => React.ReactNode }>
}

vi.mock("@/components/admin/list-view", () => ({
  ListViewCard: ({ rows, columnDefs }: MockListViewProps) => (
    <table>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            {columnDefs.map((c) => (
              <td key={c.id}>{c.render(r)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}))

const colors: ColorOption[] = [
  { id: "c1", name: "Royal Blue", hexCode: "#002366", createdAt: new Date("2026-07-01"), updatedAt: new Date("2026-07-05") },
  { id: "c2", name: "Multi-color", hexCode: "", createdAt: new Date("2026-07-01"), updatedAt: new Date("2026-07-05") },
]

describe("ColorListView", () => {
  // Validates that each colour row renders its name and hex code text.
  it("renders colour names and hex codes", () => {
    render(<ColorListView colors={colors} views={[{ id: "all", label: "All", count: 2 }]} activeView="all" />)
    expect(screen.getByText("Royal Blue")).toBeInTheDocument()
    expect(screen.getByText("#002366")).toBeInTheDocument()
    expect(screen.getByText("Multi-color")).toBeInTheDocument()
    expect(screen.getByText("—")).toBeInTheDocument() // empty hex placeholder
  })

  // Validates the no-swatch fallback: a colour without hex renders the dashed
  // placeholder swatch (identified by its title) instead of a coloured dot.
  it("renders a placeholder swatch when hexCode is empty", () => {
    render(<ColorListView colors={colors} views={[{ id: "all", label: "All", count: 2 }]} activeView="all" />)
    expect(screen.getByTitle("No swatch")).toBeInTheDocument()
  })
})

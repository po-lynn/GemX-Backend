import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { ComingSoonView } from "@/features/reviews/components/ComingSoonView"

describe("ComingSoonView", () => {
  it("renders the breadcrumb, title, and subhead", () => {
    render(
      <ComingSoonView
        breadcrumbLabel="Overview"
        title="Overview"
        subhead="Buyer reviews publish immediately. This is where marketplace rating and seller reputation are monitored."
      />
    )
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument()
    expect(screen.getByText(/Buyer reviews publish immediately/)).toBeInTheDocument()
    expect(screen.getByText(/Coming in a later phase/)).toBeInTheDocument()
  })
})

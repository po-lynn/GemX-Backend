import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import DatePicker from "@/components/date-picker/date-picker"

afterEach(() => {
  cleanup()
})

describe("DatePicker", () => {
  // Regression: the `value` prop used to be re-synced into local `date` state via a
  // useEffect. That was rewritten to a render-time comparison (to satisfy the
  // react-hooks/set-state-in-effect lint rule) — this confirms the resync still
  // happens when the parent passes a new `value` after the initial render.
  it("updates the displayed date when the value prop changes after mount", () => {
    const { rerender } = render(<DatePicker value="2026-01-15" />)
    expect(screen.getByRole("button")).toHaveTextContent("January 15th, 2026")

    rerender(<DatePicker value="2026-03-20" />)
    expect(screen.getByRole("button")).toHaveTextContent("March 20th, 2026")
  })

  // Edge case: clearing the value prop (e.g. parent resets the form) should fall
  // back to the placeholder instead of retaining the previously selected date.
  it("falls back to the placeholder when value becomes undefined", () => {
    const { rerender } = render(<DatePicker value="2026-01-15" placeholder="Pick a date" />)
    expect(screen.getByRole("button")).toHaveTextContent("January 15th, 2026")

    rerender(<DatePicker value={undefined} placeholder="Pick a date" />)
    expect(screen.getByRole("button")).toHaveTextContent("Pick a date")
  })

  // Error state: an invalid/unparseable date string should not crash the component
  // and should render the placeholder rather than an "Invalid Date".
  it("renders the placeholder for an unparseable value", () => {
    render(<DatePicker value="not-a-date" placeholder="Pick a date" />)
    expect(screen.getByRole("button")).toHaveTextContent("Pick a date")
  })
})

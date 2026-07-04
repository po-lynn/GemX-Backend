import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { AdminSearchBox } from "@/components/admin/AdminSearchBox"
import { Command, CommandInput, CommandList, CommandEmpty } from "@/components/ui/command"

// cmdk observes its list size; jsdom has no ResizeObserver, so stub it
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as typeof ResizeObserver)

// Mock router — AdminSearchBox only needs push()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Mock the global search server action so no network/db is touched
vi.mock("@/features/search/actions/global-search", () => ({
  globalSearch: vi.fn().mockResolvedValue({ users: [], products: [] }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("AdminSearchBox clear button", () => {
  // Validates the clear button is hidden while the search box is empty
  it("does not render a clear button when query is empty", () => {
    render(<AdminSearchBox />)
    expect(screen.queryByLabelText("Clear search")).toBeNull()
  })

  // Validates the clear button appears once the user types a query
  it("shows a clear button when query is non-empty", () => {
    render(<AdminSearchBox />)
    const input = screen.getByPlaceholderText("Search products, users…")
    fireEvent.change(input, { target: { value: "ruby" } })
    expect(screen.getByLabelText("Clear search")).toBeTruthy()
  })

  // Validates clicking the clear button empties the input and removes the button
  it("clears the query and hides itself on click", () => {
    render(<AdminSearchBox />)
    const input = screen.getByPlaceholderText("Search products, users…") as HTMLInputElement
    fireEvent.change(input, { target: { value: "ruby" } })
    fireEvent.click(screen.getByLabelText("Clear search"))
    expect(input.value).toBe("")
    expect(screen.queryByLabelText("Clear search")).toBeNull()
  })
})

describe("CommandInput clear button", () => {
  function renderCommand(props: React.ComponentProps<typeof CommandInput> = {}) {
    return render(
      <Command>
        <CommandInput placeholder="Search people..." {...props} />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
        </CommandList>
      </Command>
    )
  }

  // Validates the clear button is hidden while the command input is empty
  it("does not render a clear button when empty", () => {
    renderCommand()
    expect(screen.queryByLabelText("Clear search")).toBeNull()
  })

  // Validates uncontrolled usage: typing shows the X and clicking it resets the input
  it("shows and clears in uncontrolled mode", () => {
    renderCommand()
    const input = screen.getByPlaceholderText("Search people...") as HTMLInputElement
    fireEvent.change(input, { target: { value: "alice" } })
    expect(screen.getByLabelText("Clear search")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Clear search"))
    expect(input.value).toBe("")
    expect(screen.queryByLabelText("Clear search")).toBeNull()
  })

  // Validates controlled usage: clicking the X reports an empty value to the parent
  it("calls onValueChange with empty string in controlled mode", () => {
    const onValueChange = vi.fn()
    renderCommand({ value: "bob", onValueChange })
    fireEvent.click(screen.getByLabelText("Clear search"))
    expect(onValueChange).toHaveBeenCalledWith("")
  })
})

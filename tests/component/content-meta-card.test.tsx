import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { ContentMetaCard } from "@/features/news/components/ContentMetaCard"

// Mock authClient so tests don't need a real session
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: vi.fn(),
  },
}))

import { authClient } from "@/lib/auth-client"

const mockUseSession = authClient.useSession as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockUseSession.mockReturnValue({ data: { session: { token: "test-token" } } })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function getHiddenInput(container: HTMLElement, name: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`)
  if (!input) throw new Error(`hidden input ${name} not found`)
  return input
}

describe("ContentMetaCard", () => {
  // Validates the card emits the three form fields the server actions read
  it("renders hidden category/coverImage/isFeatured inputs with defaults", () => {
    const { container } = render(<ContentMetaCard />)
    expect(getHiddenInput(container, "category").value).toBe("general")
    expect(getHiddenInput(container, "coverImage").value).toBe("")
    expect(getHiddenInput(container, "isFeatured").value).toBe("false")
  })

  // Validates initial values from an existing row are reflected in the form fields
  it("uses initial values when editing an existing item", () => {
    const { container } = render(
      <ContentMetaCard
        initialCategory="market"
        initialCoverImage="https://cdn.example.com/cover.jpg"
        initialIsFeatured
      />
    )
    expect(getHiddenInput(container, "category").value).toBe("market")
    expect(getHiddenInput(container, "coverImage").value).toBe("https://cdn.example.com/cover.jpg")
    expect(getHiddenInput(container, "isFeatured").value).toBe("true")
    // Existing cover shows the preview with a Remove button
    expect(screen.getByAltText("Cover preview")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy()
  })

  // Validates category selection updates the submitted form value and notifies the form
  it("updates the category field and calls onChange when a category is picked", () => {
    const onChange = vi.fn()
    const { container } = render(<ContentMetaCard onChange={onChange} />)
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "gemology" } })
    expect(getHiddenInput(container, "category").value).toBe("gemology")
    expect(onChange).toHaveBeenCalled()
  })

  // Validates toggling featured flips the hidden value used by the actions
  it("toggles the isFeatured field via the checkbox", () => {
    const { container } = render(<ContentMetaCard />)
    fireEvent.click(screen.getByLabelText("Featured"))
    expect(getHiddenInput(container, "isFeatured").value).toBe("true")
  })

  // Validates removing the cover clears the field so the update action clears the column
  it("clears the coverImage field when Remove is clicked", () => {
    const { container } = render(
      <ContentMetaCard initialCoverImage="https://cdn.example.com/cover.jpg" />
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(getHiddenInput(container, "coverImage").value).toBe("")
  })
})

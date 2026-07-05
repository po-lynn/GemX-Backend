import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { ColorForm } from "@/features/colors/components/ColorForm"
import {
  createColorAction,
  updateColorAction,
  deleteColorAction,
} from "@/features/colors/actions/color"

afterEach(cleanup)

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock("@/features/colors/actions/color", () => ({
  createColorAction: vi.fn(),
  updateColorAction: vi.fn(),
  deleteColorAction: vi.fn(),
}))

const editColor = {
  id: "a1b2c3d4-e5f6-4789-a012-345678901234",
  name: "Royal Blue",
  hexCode: "#002366",
  createdAt: new Date("2026-07-01"),
  updatedAt: new Date("2026-07-05"),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ColorForm (create)", () => {
  // Validates client-side guard: submitting without a name shows an error and
  // never calls the server action.
  it("blocks submit when the name is empty", async () => {
    render(<ColorForm mode="create" />)
    fireEvent.click(screen.getByRole("button", { name: /create colour/i }))
    expect(await screen.findByText(/please enter a colour name/i)).toBeInTheDocument()
    expect(createColorAction).not.toHaveBeenCalled()
  })

  // Validates the happy path: name + hex are sent to the action as FormData,
  // then the form navigates back to the list.
  it("submits name and hex, then navigates to the list", async () => {
    vi.mocked(createColorAction).mockResolvedValue({ success: true, colorId: "new-id" })
    render(<ColorForm mode="create" />)
    fireEvent.change(screen.getByLabelText(/colour name/i), { target: { value: "Teal" } })
    fireEvent.change(screen.getByLabelText(/hex code/i), { target: { value: "#008080" } })
    fireEvent.click(screen.getByRole("button", { name: /create colour/i }))
    await waitFor(() => expect(createColorAction).toHaveBeenCalledTimes(1))
    const fd = vi.mocked(createColorAction).mock.calls[0]![0] as FormData
    expect(fd.get("name")).toBe("Teal")
    expect(fd.get("hexCode")).toBe("#008080")
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/colors"))
  })

  // Validates server-error surfacing: an action error renders in the form.
  it("shows the action error message on failure", async () => {
    vi.mocked(createColorAction).mockResolvedValue({ error: "A colour with this name already exists" })
    render(<ColorForm mode="create" />)
    fireEvent.change(screen.getByLabelText(/colour name/i), { target: { value: "Red" } })
    fireEvent.click(screen.getByRole("button", { name: /create colour/i }))
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})

describe("ColorForm (edit)", () => {
  // Validates pre-fill: edit mode shows the existing name and hex.
  it("pre-fills name and hex from the colour", () => {
    render(<ColorForm mode="edit" color={editColor} />)
    expect(screen.getByLabelText(/colour name/i)).toHaveValue("Royal Blue")
    expect(screen.getByLabelText(/hex code/i)).toHaveValue("#002366")
  })

  // Validates update path: submitting sends colorId along with the fields.
  it("submits the colorId on update", async () => {
    vi.mocked(updateColorAction).mockResolvedValue({ success: true, colorId: editColor.id })
    render(<ColorForm mode="edit" color={editColor} />)
    fireEvent.change(screen.getByLabelText(/colour name/i), { target: { value: "Navy" } })
    fireEvent.click(screen.getByRole("button", { name: /update colour/i }))
    await waitFor(() => expect(updateColorAction).toHaveBeenCalledTimes(1))
    const fd = vi.mocked(updateColorAction).mock.calls[0]![0] as FormData
    expect(fd.get("colorId")).toBe(editColor.id)
    expect(fd.get("name")).toBe("Navy")
  })

  // Validates delete flow: confirm step required, then the action fires and
  // the form navigates back to the list.
  it("deletes after confirmation", async () => {
    vi.mocked(deleteColorAction).mockResolvedValue({ success: true })
    render(<ColorForm mode="edit" color={editColor} />)
    fireEvent.click(screen.getByRole("button", { name: /delete permanently/i }))
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }))
    await waitFor(() => expect(deleteColorAction).toHaveBeenCalledTimes(1))
    const fd = vi.mocked(deleteColorAction).mock.calls[0]![0] as FormData
    expect(fd.get("colorId")).toBe(editColor.id)
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/colors"))
  })
})

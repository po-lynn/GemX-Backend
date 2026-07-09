import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { ShareButtons } from "@/components/share/ShareButtons"

afterEach(cleanup)

const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args), error: (...args: unknown[]) => toastError(...args) },
}))

const writeText = vi.fn()

beforeEach(() => {
  toastSuccess.mockClear()
  toastError.mockClear()
  writeText.mockClear()
  Object.assign(navigator, { clipboard: { writeText } })
})

describe("ShareButtons", () => {
  // Enabled state: all three actions are present and point at the right targets
  it("renders Facebook, Telegram, and Copy link with correct hrefs when enabled", () => {
    render(<ShareButtons url="https://gemx.example.com/articles/abc" title="A Great Article" />)

    const fb = screen.getByRole("link", { name: /facebook/i })
    expect(fb).toHaveAttribute(
      "href",
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fgemx.example.com%2Farticles%2Fabc"
    )

    const tg = screen.getByRole("link", { name: /telegram/i })
    expect(tg).toHaveAttribute(
      "href",
      "https://t.me/share/url?url=https%3A%2F%2Fgemx.example.com%2Farticles%2Fabc&text=A%20Great%20Article"
    )

    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument()
  })

  // Disabled state: anchors have no href (not navigable) and the tooltip reason is shown
  it("disables all three actions and shows the reason as a title tooltip", () => {
    render(
      <ShareButtons
        url=""
        title="A Draft"
        disabled
        disabledReason="Publish first to share"
      />
    )
    expect(screen.getByRole("link", { name: /facebook/i })).not.toHaveAttribute("href")
    expect(screen.getByRole("link", { name: /telegram/i })).not.toHaveAttribute("href")
    expect(screen.getByRole("button", { name: /copy link/i })).toBeDisabled()
    expect(screen.getByTitle("Publish first to share")).toBeInTheDocument()
  })

  // Copy link success: clipboard API is called with the url and a success toast fires
  it("copies the url and shows a success toast", async () => {
    render(<ShareButtons url="https://gemx.example.com/articles/abc" title="A Great Article" />)
    writeText.mockResolvedValueOnce(undefined)

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }))

    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("https://gemx.example.com/articles/abc"))
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Link copied"))
  })

  // Copy link failure: clipboard rejection shows an error toast instead of throwing
  it("shows an error toast when the clipboard write fails", async () => {
    render(<ShareButtons url="https://gemx.example.com/articles/abc" title="A Great Article" />)
    writeText.mockRejectedValueOnce(new Error("denied"))

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }))

    await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith("Couldn't copy link"))
  })
})

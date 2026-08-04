import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { MessagesTriagePage } from "@/features/messages/components/triage/MessagesTriagePage"
import type { TriageConversation, TriageMessage } from "@/features/messages/types/triage"

const replace = vi.fn()
const refresh = vi.fn()
let mockSearch = ""

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  usePathname: () => "/admin/messages",
  useSearchParams: () => new URLSearchParams(mockSearch),
}))

const { toastFn, setMessageStarredAction, deleteMessageAction } = vi.hoisted(() => ({
  toastFn: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
  setMessageStarredAction: vi.fn(async (_formData: FormData) => ({ success: true })),
  deleteMessageAction: vi.fn(async (_formData: FormData) => ({ success: true })),
}))
vi.mock("sonner", () => ({ toast: toastFn }))
vi.mock("@/features/messages/actions/messages", () => ({
  setMessageStarredAction,
  deleteMessageAction,
}))

function lastReplacedQuery(): URLSearchParams {
  const call = replace.mock.calls.at(-1)
  const url = call?.[0] as string
  return new URLSearchParams(url.split("?")[1] ?? "")
}

const CONVERSATIONS: TriageConversation[] = [
  {
    id: "pair-c2",
    participantA: { id: "gemx4", name: "Gemx4" },
    participantB: { id: "supervisor", name: "Supervisor" },
    type: "chat",
    lastMessagePreview: "Doing exercise",
    lastMessageAt: "2026-07-29T21:56:00+06:30",
    messageCount: 34,
    flagged: false,
    awaitingReply: false,
    assignedToMe: false,
    resolved: true,
  },
  {
    id: "pair-c10",
    participantA: { id: "testing", name: "Testing" },
    participantB: { id: "phyu", name: "Phyu Phyu Aung" },
    type: "chat",
    lastMessagePreview: "Test",
    lastMessageAt: "2026-06-14T09:30:00+06:30",
    messageCount: 7,
    tag: "REPORTED",
    flagged: true,
    awaitingReply: false,
    assignedToMe: false,
    resolved: false,
  },
]

const MESSAGES: TriageMessage[] = [
  {
    id: "msg-1",
    conversationId: "pair-c2",
    from: { id: "gemx4", name: "Gemx4" },
    to: { id: "supervisor", name: "Supervisor" },
    body: "Doing exercise",
    sentAt: "2026-07-29T21:56:00+06:30",
    type: "chat",
    flagged: false,
    awaitingReply: false,
    assignedToMe: false,
    resolved: true,
  },
  {
    id: "msg-2",
    conversationId: "pair-c10",
    from: { id: "testing", name: "Testing" },
    to: { id: "phyu", name: "Phyu Phyu Aung" },
    body: "Test",
    sentAt: "2026-06-14T09:30:00+06:30",
    type: "chat",
    flagged: true,
    awaitingReply: false,
    assignedToMe: false,
    resolved: false,
  },
]

beforeEach(() => {
  replace.mockClear()
  refresh.mockClear()
  toastFn.mockClear()
  toastFn.success.mockClear()
  toastFn.error.mockClear()
  setMessageStarredAction.mockClear()
  deleteMessageAction.mockClear()
  mockSearch = ""
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, messages: [], page: 1, limit: 200, total: 0 }),
    }))
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderPage() {
  return render(<MessagesTriagePage initialConversations={CONVERSATIONS} initialMessages={MESSAGES} />)
}

describe("MessagesTriagePage", () => {
  // Validates the default view (no URL params) selects the newest conversation
  // by lastMessageAt and shows it in the reading pane.
  it("defaults to the newest conversation selected", () => {
    renderPage()
    expect(screen.getAllByText("Gemx4 ↔ Supervisor").length).toBeGreaterThan(0)
  })

  // Validates clicking the "All messages" segment requests a mode=messages URL update.
  it("requests a mode=messages URL update when the mode toggle is clicked", () => {
    renderPage()
    fireEvent.click(screen.getByText("All messages"))
    expect(lastReplacedQuery().get("mode")).toBe("messages")
  })

  // Validates clicking a status rail row requests a status URL update.
  it("requests a status URL update when a status rail row is clicked", () => {
    renderPage()
    fireEvent.click(screen.getByText("Flagged"))
    expect(lastReplacedQuery().get("status")).toBe("flagged")
  })

  // Validates the search box narrows the visible rows instantly.
  it("filters the list instantly as the search box changes", () => {
    renderPage()
    expect(screen.getByText(/Testing ↔ Phyu Phyu Aung/)).toBeInTheDocument()
    const input = screen.getByPlaceholderText("Search conversations, participants…")
    fireEvent.change(input, { target: { value: "phyu" } })
    // Now the only match, so it appears in both the list row and (via the
    // selection fallback) the reading pane header.
    expect(screen.getAllByText(/Testing ↔ Phyu Phyu Aung/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Gemx4 ↔ Supervisor/)).not.toBeInTheDocument()
  })

  // Validates that selecting a filter which hides the currently-selected row
  // falls back to the first row of the newly-filtered list rather than
  // showing a stale/blank reading pane.
  it("falls back the reading pane selection when a filter hides the active row", () => {
    mockSearch = "status=all&selectedId=pair-c2"
    const { rerender } = renderPage()
    expect(screen.getAllByText("Gemx4 ↔ Supervisor").length).toBeGreaterThan(0)

    fireEvent.click(screen.getByText("Flagged"))
    // Simulate the router applying the update, then re-render so the
    // selection-fallback effect can observe the new (status=flagged) URL.
    mockSearch = lastReplacedQuery().toString()
    rerender(<MessagesTriagePage initialConversations={CONVERSATIONS} initialMessages={MESSAGES} />)

    expect(lastReplacedQuery().get("selectedId")).not.toBe("pair-c2")
  })

  // Validates Flag is a real, wired action in All-messages mode: it calls the
  // real server action with the selected message's id and refreshes on success.
  it("calls setMessageStarredAction and refreshes when Flag is clicked in All-messages mode", async () => {
    mockSearch = "mode=messages&selectedId=msg-1"
    renderPage()

    fireEvent.click(screen.getByText("Flag"))

    await waitFor(() => expect(setMessageStarredAction).toHaveBeenCalledTimes(1))
    const formData = setMessageStarredAction.mock.calls[0][0] as FormData
    expect(formData.get("id")).toBe("msg-1")
    expect(formData.get("starred")).toBe("true")
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  // Validates Delete opens a confirmation dialog rather than deleting immediately,
  // and only calls the real action once the user confirms.
  it("requires confirmation before calling deleteMessageAction", async () => {
    mockSearch = "mode=messages&selectedId=msg-1"
    renderPage()

    fireEvent.click(screen.getByText("Delete"))
    expect(deleteMessageAction).not.toHaveBeenCalled()

    const confirmButton = await screen.findByRole("button", { name: "Delete" });
    fireEvent.click(confirmButton)

    await waitFor(() => expect(deleteMessageAction).toHaveBeenCalledTimes(1))
    const formData = deleteMessageAction.mock.calls[0][0] as FormData
    expect(formData.get("id")).toBe("msg-1")
  })

  // Validates Flag falls back to the "not wired" toast in Conversations mode,
  // where no single message is unambiguously selected.
  it("shows the not-wired toast for Flag in Conversations mode", () => {
    renderPage()
    fireEvent.click(screen.getByText("Flag"))
    expect(toastFn).toHaveBeenCalledWith("Not wired yet in this preview.")
    expect(setMessageStarredAction).not.toHaveBeenCalled()
  })

  // Regression: attachment messages must render the actual image/link, not
  // just the bare "Attachment"/"Photo" label with no way to open the file.
  it("renders an image thumbnail for an image attachment instead of a label", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          messages: [
            {
              id: "msg-img",
              senderId: "gemx4",
              content: "",
              fileUrl: "https://storage.example.com/chat-media/photo.jpg",
              imageUrls: ["https://storage.example.com/chat-media/photo.jpg"],
              messageType: "image",
              createdAt: "2026-07-29T21:56:00+06:30",
              starred: false,
            },
          ],
          page: 1,
          limit: 200,
          total: 1,
        }),
      }))
    )
    const { container } = renderPage()

    // Empty alt text gives the <img> an accessibility role of "presentation",
    // not "img", so we query the DOM directly rather than via getByRole.
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull())
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://storage.example.com/chat-media/photo.jpg"
    )
    expect(screen.queryByText("Photo")).not.toBeInTheDocument()
  })

  // Clicking an inline attachment thumbnail must open the full-size image
  // viewer, not just leave the small 96x96 crop as the only way to see it.
  it("opens the image viewer when an attachment thumbnail is clicked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          messages: [
            {
              id: "msg-img-click",
              senderId: "gemx4",
              content: "",
              fileUrl: "https://storage.example.com/chat-media/photo.jpg",
              imageUrls: ["https://storage.example.com/chat-media/photo.jpg"],
              messageType: "image",
              createdAt: "2026-07-29T21:56:00+06:30",
              starred: false,
            },
          ],
          page: 1,
          limit: 200,
          total: 1,
        }),
      }))
    )
    const { container } = renderPage()

    await waitFor(() => expect(container.querySelector("img")).not.toBeNull())
    expect(screen.queryByRole("dialog", { name: "Image viewer" })).not.toBeInTheDocument()

    fireEvent.click(container.querySelector("img")!)

    const viewer = await screen.findByRole("dialog", { name: "Image viewer" })
    expect(viewer.querySelector(".pd-viewer-img")).toHaveAttribute(
      "src",
      "https://storage.example.com/chat-media/photo.jpg"
    )

    fireEvent.click(screen.getByRole("button", { name: "Close viewer" }))
    expect(screen.queryByRole("dialog", { name: "Image viewer" })).not.toBeInTheDocument()
  })

  // Regression: real chat data stores single-image messages with only
  // fileUrl + messageType="image" set (imageUrls is null — it's only
  // populated for multi-image gallery messages). This must still render as
  // an inline image, not fall through to the "Attachment" link branch.
  it("renders an image thumbnail when only fileUrl (not imageUrls) is set for an image message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          messages: [
            {
              id: "msg-img-file-only",
              senderId: "gemx4",
              content: "",
              fileUrl: "https://storage.example.com/chat-media/single-photo.jpg",
              imageUrls: null,
              messageType: "image",
              createdAt: "2026-07-29T21:56:00+06:30",
              starred: false,
            },
          ],
          page: 1,
          limit: 200,
          total: 1,
        }),
      }))
    )
    const { container } = renderPage()

    await waitFor(() => expect(container.querySelector("img")).not.toBeNull())
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://storage.example.com/chat-media/single-photo.jpg"
    )
    expect(screen.queryByRole("link", { name: "Attachment" })).not.toBeInTheDocument()
  })

  // Regression: a non-image file attachment must render as a clickable link
  // to fileUrl, not the literal word "Attachment" with nothing behind it.
  it("renders a clickable link for a non-image attachment instead of a plain label", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          messages: [
            {
              id: "msg-file",
              senderId: "gemx4",
              content: "",
              fileUrl: "https://storage.example.com/chat-media/invoice.pdf",
              imageUrls: null,
              messageType: "file",
              createdAt: "2026-07-29T21:56:00+06:30",
              starred: false,
            },
          ],
          page: 1,
          limit: 200,
          total: 1,
        }),
      }))
    )
    renderPage()

    const link = await screen.findByRole("link", { name: "Attachment" })
    expect(link).toHaveAttribute("href", "https://storage.example.com/chat-media/invoice.pdf")
  })

  // Regression: a single static date pill derived from only the first
  // message misrepresented threads spanning multiple days (later messages
  // showed only a time, with no indication they were on a different day
  // than the pill at the top). Each day boundary in the thread must get its
  // own date divider.
  it("shows a date divider per calendar day in a thread spanning multiple days", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          messages: [
            {
              id: "msg-day1-a",
              senderId: "gemx4",
              content: "Have you",
              fileUrl: null,
              imageUrls: null,
              messageType: "text",
              createdAt: "2026-06-14T19:04:00+06:30",
              starred: false,
            },
            {
              id: "msg-day1-b",
              senderId: "gemx4",
              content: "seen this?",
              fileUrl: null,
              imageUrls: null,
              messageType: "text",
              createdAt: "2026-06-14T19:05:00+06:30",
              starred: false,
            },
            {
              id: "msg-day2",
              senderId: "gemx4",
              content: "following up",
              fileUrl: null,
              imageUrls: null,
              messageType: "text",
              createdAt: "2026-07-26T22:20:00+06:30",
              starred: false,
            },
          ],
          page: 1,
          limit: 200,
          total: 3,
        }),
      }))
    )
    renderPage()

    await screen.findByText("Have you")
    expect(screen.getByText("Jun 14, 2026")).toBeInTheDocument()
    expect(screen.getByText("Jul 26, 2026")).toBeInTheDocument()
    // Same-day messages share one divider, not one per message.
    expect(screen.getAllByText("Jun 14, 2026")).toHaveLength(1)
  })
})

import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react"
import { AdminAllConversationsView } from "@/features/chat/components/AdminAllConversationsView"
import type { AdminConversationListItem } from "@/features/chat/db/admin-all-conversations"

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={(props.alt as string) ?? ""} src={props.src as string} />
  },
}))

const CONVERSATIONS: AdminConversationListItem[] = [
  {
    participants: [
      { id: "gemx4", name: "Gemx4", image: null, role: "user" },
      { id: "supervisor", name: "Supervisor", image: null, role: "internal" },
    ],
    lastMessage: "Photo",
    lastMessageTime: "2026-07-29T21:56:00+06:30",
    lastMessageType: "image",
  },
]

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderView() {
  return render(<AdminAllConversationsView conversations={CONVERSATIONS} page={1} pageSize={20} total={1} />)
}

describe("AdminAllConversationsView", () => {
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
              recipientId: "supervisor",
              content: "",
              fileUrl: "https://storage.example.com/chat-media/single-photo.jpg",
              imageUrls: null,
              messageType: "image",
              createdAt: "2026-07-29T21:56:00+06:30",
            },
          ],
        }),
      }))
    )
    const { container } = renderView()

    fireEvent.click(screen.getByText(/Gemx4/))

    await waitFor(() => expect(container.querySelector("img")).not.toBeNull())
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://storage.example.com/chat-media/single-photo.jpg"
    )
    expect(screen.queryByRole("link", { name: "Attachment" })).not.toBeInTheDocument()
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
              recipientId: "supervisor",
              content: "",
              fileUrl: "https://storage.example.com/chat-media/single-photo.jpg",
              imageUrls: null,
              messageType: "image",
              createdAt: "2026-07-29T21:56:00+06:30",
            },
          ],
        }),
      }))
    )
    const { container } = renderView()

    fireEvent.click(screen.getByText(/Gemx4/))
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull())

    fireEvent.click(container.querySelector("img")!)

    const viewer = await screen.findByRole("dialog", { name: "Image viewer" })
    expect(viewer.querySelector(".pd-viewer-img")).toHaveAttribute(
      "src",
      "https://storage.example.com/chat-media/single-photo.jpg"
    )
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
              recipientId: "supervisor",
              content: "",
              fileUrl: "https://storage.example.com/chat-media/invoice.pdf",
              imageUrls: null,
              messageType: "file",
              createdAt: "2026-07-29T21:56:00+06:30",
            },
          ],
        }),
      }))
    )
    renderView()

    fireEvent.click(screen.getByText(/Gemx4/))

    const link = await screen.findByRole("link", { name: "Attachment" })
    expect(link).toHaveAttribute("href", "https://storage.example.com/chat-media/invoice.pdf")
  })

  // Regression: this view showed only a per-message time, with no date
  // anywhere — a thread spanning multiple days gave no indication of which
  // day each message was on. Each day boundary must get its own divider.
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
              recipientId: "supervisor",
              content: "Have you",
              fileUrl: null,
              imageUrls: null,
              messageType: "text",
              createdAt: "2026-06-14T19:04:00+06:30",
            },
            {
              id: "msg-day1-b",
              senderId: "gemx4",
              recipientId: "supervisor",
              content: "seen this?",
              fileUrl: null,
              imageUrls: null,
              messageType: "text",
              createdAt: "2026-06-14T19:05:00+06:30",
            },
            {
              id: "msg-day2",
              senderId: "gemx4",
              recipientId: "supervisor",
              content: "following up",
              fileUrl: null,
              imageUrls: null,
              messageType: "text",
              createdAt: "2026-07-26T22:20:00+06:30",
            },
          ],
        }),
      }))
    )
    renderView()

    fireEvent.click(screen.getByText(/Gemx4/))

    await screen.findByText("Have you")
    expect(screen.getByText("Jun 14, 2026")).toBeInTheDocument()
    expect(screen.getByText("Jul 26, 2026")).toBeInTheDocument()
    expect(screen.getAllByText("Jun 14, 2026")).toHaveLength(1)
  })
})

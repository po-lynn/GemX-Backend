import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { ConversationList, type TriageListRow } from "@/features/messages/components/triage/ConversationList"

afterEach(cleanup)

const rows: TriageListRow[] = [
  {
    id: "c1",
    avatarId: "ni",
    avatarName: "Ni",
    title: "Ni ↔ Testing",
    preview: "Price is negotiable if you take both stones",
    time: "4d ago",
    meta: "18 messages",
    tag: "OFF-PLATFORM",
    selected: true,
    awaitingReply: false,
  },
  {
    id: "c2",
    avatarId: "gemx4",
    avatarName: "Gemx4",
    title: "Gemx4 ↔ Supervisor",
    preview: "Doing exercise",
    time: "2d ago",
    meta: "34 messages",
    selected: false,
    awaitingReply: true,
  },
]

function renderList(overrides: Partial<React.ComponentProps<typeof ConversationList>> = {}) {
  const props: React.ComponentProps<typeof ConversationList> = {
    mode: "conversations",
    query: "",
    onQueryChange: vi.fn(),
    sortDesc: true,
    onToggleSort: vi.fn(),
    resultLabel: "All statuses · 2 conversations",
    rows,
    onSelectRow: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<ConversationList {...props} />) }
}

describe("ConversationList", () => {
  // Validates every row's title, preview, and tag render
  it("renders a row per item with title, preview, and tag", () => {
    renderList()
    expect(screen.getByText("Ni ↔ Testing")).toBeInTheDocument()
    expect(screen.getByText("Price is negotiable if you take both stones")).toBeInTheDocument()
    expect(screen.getByText("OFF-PLATFORM")).toBeInTheDocument()
    expect(screen.getByText("Gemx4 ↔ Supervisor")).toBeInTheDocument()
  })

  // Validates clicking a row calls onSelectRow with that row's id
  it("calls onSelectRow with the row id on click", () => {
    const { props } = renderList()
    fireEvent.click(screen.getByText("Gemx4 ↔ Supervisor"))
    expect(props.onSelectRow).toHaveBeenCalledWith("c2")
  })

  // Validates the search input reports typed text via onQueryChange
  it("calls onQueryChange as the search input changes", () => {
    const { props } = renderList()
    const input = screen.getByPlaceholderText("Search conversations, participants…")
    fireEvent.change(input, { target: { value: "ruby" } })
    expect(props.onQueryChange).toHaveBeenCalledWith("ruby")
  })

  // Validates the sort toggle button reflects and reports the current direction
  it("shows Newest/Oldest label and calls onToggleSort on click", () => {
    const { props } = renderList({ sortDesc: false })
    expect(screen.getByText(/Oldest/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Oldest/))
    expect(props.onToggleSort).toHaveBeenCalled()
  })

  // Validates the empty state renders when there are no rows
  it("renders the empty state when rows is empty", () => {
    renderList({ rows: [] })
    expect(screen.getByText("No matches")).toBeInTheDocument()
    expect(screen.getByText("Try a different term or switch view.")).toBeInTheDocument()
  })

  // Validates the messages-mode search placeholder differs from conversations mode
  it("uses the messages-mode search placeholder when mode is 'messages'", () => {
    renderList({ mode: "messages" })
    expect(screen.getByPlaceholderText("Search message text, SKU…")).toBeInTheDocument()
  })

  // Validates an "awaiting reply" row gets a visible dot indicator and pill,
  // and a row that isn't awaiting gets neither — this is the whole point of
  // making unread/awaiting conversations easy to spot without opening them.
  it("shows an awaiting-reply dot and pill only on rows flagged as awaiting", () => {
    renderList()
    expect(screen.getAllByLabelText("Awaiting reply")).toHaveLength(1)
    expect(screen.getByText("Awaiting reply")).toBeInTheDocument()
  })
})

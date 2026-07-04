import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react"
import {
  PremiumDealerSubscriptionsTable,
  subscriptionGroupKey,
} from "@/features/points/components/PremiumDealerSubscriptionsTable"
import type { PremiumDealerSubscriptionRow } from "@/features/points/db/points"

// jsdom has no ResizeObserver; list-view internals may observe layout
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as typeof ResizeObserver)

// Mock router — the table only needs refresh() after server actions
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

// Mock server actions so no network/db is touched
vi.mock("@/features/points/actions/points", () => ({
  deactivatePremiumDealerAction: vi.fn().mockResolvedValue({}),
  updateSubscriptionExpiryAction: vi.fn().mockResolvedValue({}),
}))

function makeRow(overrides: Partial<PremiumDealerSubscriptionRow>): PremiumDealerSubscriptionRow {
  return {
    id: "sub-1",
    userId: "user-1",
    userName: "Alice Smith",
    userEmail: "alice@example.com",
    packageName: "Gold",
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    autoRenew: false,
    status: "active",
    createdAt: new Date("2026-01-01"),
    ...overrides,
  }
}

const rows: PremiumDealerSubscriptionRow[] = [
  // Two subscriptions for the same user — must land in one group
  makeRow({ id: "sub-1", createdAt: new Date("2026-03-01"), startDate: new Date("2026-03-01") }),
  makeRow({ id: "sub-2", status: "expired", createdAt: new Date("2026-01-01") }),
  // User row where the join returned no name — falls back to email
  makeRow({
    id: "sub-3",
    userId: "user-2",
    userName: null,
    userEmail: "bob@example.com",
    createdAt: new Date("2026-02-01"),
    startDate: new Date("2026-02-01"),
  }),
  // Deleted/missing user — both name and email null
  makeRow({
    id: "sub-4",
    userId: "user-3",
    userName: null,
    userEmail: null,
    createdAt: new Date("2026-01-15"),
    startDate: new Date("2026-01-15"),
  }),
]

function renderTable() {
  return render(
    <PremiumDealerSubscriptionsTable
      subscriptions={rows}
      page={1}
      pageSize={20}
      total={rows.length}
    />
  )
}

function groupByUser() {
  fireEvent.click(screen.getByRole("button", { name: "Group" }))
  const menu = screen.getByRole("menu")
  fireEvent.click(within(menu).getByRole("button", { name: "User" }))
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("subscriptionGroupKey", () => {
  // Validates the display key combines name and email so same-named users stay distinct
  it("returns 'Name (email)' when both are present", () => {
    expect(
      subscriptionGroupKey({ userName: "Alice Smith", userEmail: "alice@example.com" }, "user")
    ).toBe("Alice Smith (alice@example.com)")
  })

  // Validates fallback to email when the user join has no name
  it("falls back to email when name is null", () => {
    expect(subscriptionGroupKey({ userName: null, userEmail: "bob@example.com" }, "user")).toBe(
      "bob@example.com"
    )
  })

  // Validates fallback to name alone when email is null
  it("falls back to name when email is null", () => {
    expect(subscriptionGroupKey({ userName: "Alice Smith", userEmail: null }, "user")).toBe(
      "Alice Smith"
    )
  })

  // Validates a stable bucket for rows whose user record is gone entirely
  it("returns 'Unknown user' when both name and email are null", () => {
    expect(subscriptionGroupKey({ userName: null, userEmail: null }, "user")).toBe("Unknown user")
  })

  // Validates other group ids fall through to ListViewCard's default field lookup
  it("returns null for non-user group ids", () => {
    expect(
      subscriptionGroupKey({ userName: "Alice Smith", userEmail: "alice@example.com" }, "status")
    ).toBeNull()
    expect(
      subscriptionGroupKey({ userName: "Alice Smith", userEmail: "alice@example.com" }, "packageName")
    ).toBeNull()
  })
})

describe("PremiumDealerSubscriptionsTable group by user", () => {
  // Validates the new "User" entry appears in the Group popover
  it("offers a User option in the group menu", () => {
    renderTable()
    fireEvent.click(screen.getByRole("button", { name: "Group" }))
    const menu = screen.getByRole("menu")
    expect(within(menu).getByRole("button", { name: "User" })).toBeTruthy()
  })

  // Validates rows bucket per user: 3 groups for 4 rows, same user merged
  it("renders one group header per user with correct counts", () => {
    const { container } = renderTable()
    groupByUser()

    const headers = Array.from(container.querySelectorAll(".lv-grouprow-name")).map(
      (el) => el.textContent
    )
    expect(headers).toHaveLength(3)
    expect(headers).toContain("Alice Smith (alice@example.com)")
    expect(headers).toContain("bob@example.com")
    expect(headers).toContain("Unknown user")

    // Alice has two subscriptions — her group count must be 2
    const aliceHeader = Array.from(container.querySelectorAll(".lv-grouprow-inner")).find((el) =>
      el.textContent?.includes("Alice Smith (alice@example.com)")
    )
    expect(aliceHeader?.querySelector(".lv-grouprow-count")?.textContent).toBe("2")
  })

  // Validates grouping by status still works via the default key lookup (regression)
  it("still groups by status through the default lookup", () => {
    const { container } = renderTable()
    fireEvent.click(screen.getByRole("button", { name: "Group" }))
    const menu = screen.getByRole("menu")
    fireEvent.click(within(menu).getByRole("button", { name: "Status" }))

    const headers = Array.from(container.querySelectorAll(".lv-grouprow-name")).map(
      (el) => el.textContent
    )
    expect(headers).toContain("active")
    expect(headers).toContain("expired")
  })
})

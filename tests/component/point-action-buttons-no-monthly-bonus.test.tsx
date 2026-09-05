import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/features/points/actions/points", () => ({
  adminTopUpUserPointsAction: vi.fn(),
  adminDeductUserPointsAction: vi.fn(),
}))

vi.mock("@/features/users/actions/users", () => ({
  searchUsersForPickerAction: vi.fn(),
}))

import { PointActionButtons } from "@/features/points/components/PointActionButtons"

describe("PointActionButtons", () => {
  // Validates: Monthly Bonus Points was removed from the transactions header; Top-up/Deduct remain.
  it("renders Top-up and Deduct but not Monthly Bonus Points", () => {
    render(<PointActionButtons activeUserCount={10} />)

    expect(screen.getByRole("button", { name: /top-?up/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /deduct/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /monthly bonus/i })).not.toBeInTheDocument()
  })
})

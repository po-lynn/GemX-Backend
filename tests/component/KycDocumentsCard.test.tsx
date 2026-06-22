import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { KycDocumentsCard } from "@/features/users/components/KycDocumentsCard"
import { approveUserKycAction, rejectUserKycAction } from "@/features/users/actions/kyc-actions"

vi.mock("@/features/users/actions/kyc-actions", () => ({
  approveUserKycAction: vi.fn(),
  rejectUserKycAction: vi.fn(),
}))

const BASE_USER = {
  id: "user-1",
  name: "Aung Ko",
  email: "test@example.com",
  role: "user",
  phone: "09123456789",
  gender: null,
  dateOfBirth: null,
  points: 0,
  emailVerified: true,
  verified: false,
  archived: false,
  createdAt: new Date("2026-06-22T10:00:00Z"),
  updatedAt: new Date("2026-06-22T10:00:00Z"),
  image: null,
  username: null,
  displayUsername: null,
  nrc: null,
  address: null,
  city: null,
  state: null,
  country: null,
  nrcFrontUrl: null,
  nrcBackUrl: null,
  selfieUrl: null,
  businessLicenseUrl: null,
}

describe("KycDocumentsCard", () => {
  beforeEach(() => {
    vi.mocked(approveUserKycAction).mockResolvedValue({ ok: true })
    vi.mocked(rejectUserKycAction).mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    cleanup()
  })

  it("shows 'No documents submitted' when no NRC and no doc URLs", () => {
    render(<KycDocumentsCard userId="user-1" user={BASE_USER} />)
    expect(screen.getByText(/no documents submitted/i)).toBeInTheDocument()
  })

  it("shows NRC number when present", () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456" }} />)
    expect(screen.getByText("12/ABC(N)123456")).toBeInTheDocument()
  })

  it("shows Approve button when user is not verified and has an NRC", () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456" }} />)
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument()
  })

  it("shows Reject button when user is already verified", () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456", verified: true }} />)
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument()
  })

  it("shows NRC front link when nrcFrontUrl is present", () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456", nrcFrontUrl: "https://example.com/nrc-front.jpg" }} />)
    const link = screen.getByRole("link", { name: /nrc front/i })
    expect(link).toHaveAttribute("href", "https://example.com/nrc-front.jpg")
  })

  it("does not show nrcBackUrl link when nrcBackUrl is null", () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456", nrcBackUrl: null }} />)
    expect(screen.queryByRole("link", { name: /nrc back/i })).not.toBeInTheDocument()
  })

  it("calls approveUserKycAction with userId when Approve is clicked", async () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456" }} />)
    fireEvent.click(screen.getByRole("button", { name: /approve/i }))
    await waitFor(() => expect(approveUserKycAction).toHaveBeenCalledWith("user-1"))
  })

  it("calls rejectUserKycAction with userId when Reject is clicked", async () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456", verified: true }} />)
    fireEvent.click(screen.getByRole("button", { name: /reject/i }))
    await waitFor(() => expect(rejectUserKycAction).toHaveBeenCalledWith("user-1"))
  })

  it("shows verified badge when user is verified", () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456", verified: true }} />)
    expect(screen.getByTestId("kyc-verified-status")).toHaveTextContent(/verified/i)
  })
})

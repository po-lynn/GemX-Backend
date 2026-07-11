import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { GET } from "@/app/api/mobile/help-support/route"
import { getCachedPublishedHelpSupport } from "@/features/app-content/db/cache/app-content"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/features/app-content/db/cache/app-content", () => ({
  getCachedPublishedHelpSupport: vi.fn(),
}))

const FAQ_ACTIVE = { id: "f1", question: "Q1", answer: "A1", isActive: true, sortOrder: 1 }
const FAQ_HIDDEN = { id: "f2", question: "Q2", answer: "A2", isActive: false, sortOrder: 0 }

describe("GET /api/mobile/help-support", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(connection).mockResolvedValue(undefined)
  })

  it("returns only active FAQs sorted by sortOrder, plus contact/hours/reportForm", async () => {
    vi.mocked(getCachedPublishedHelpSupport).mockResolvedValue({
      faqs: [FAQ_ACTIVE, FAQ_HIDDEN],
      supportEmail: "support@gemx.app",
      supportPhone: "+95 9 250 000 111",
      liveChatTelegram: "t.me/gemxsupport",
      weekdayHours: "9:00–18:00",
      saturdayHours: "10:00–15:00",
      sundayHours: "Closed",
      timezone: "Asia/Yangon (UTC+06:30)",
      reportFormEnabled: true,
      reportCategories: ["Bug", "Payment"],
      allowScreenshotAttachments: true,
    })
    const req = new Request("http://localhost/api/mobile/help-support")
    const res = await GET(req as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.faqs).toHaveLength(1)
    expect(body.faqs[0]).toMatchObject({ question: "Q1" })
    expect(body.contact).toMatchObject({ email: "support@gemx.app" })
    expect(body.hours).toMatchObject({ weekday: "9:00–18:00", timezone: "Asia/Yangon (UTC+06:30)" })
    expect(body.reportForm).toMatchObject({ enabled: true, categories: ["Bug", "Payment"] })
  })
})

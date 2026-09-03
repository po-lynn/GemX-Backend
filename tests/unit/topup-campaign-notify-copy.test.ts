import { describe, expect, it } from "vitest"
import { getTopUpCampaignNotifyCopy } from "@/features/points/constants/topup-campaign-notify"

describe("getTopUpCampaignNotifyCopy", () => {
  it("builds English title, body, and chat content with campaign name", () => {
    const copy = getTopUpCampaignNotifyCopy(1000, "New Year Promo", "en")

    expect(copy.title).toContain("bonus points")
    expect(copy.body).toContain("New Year Promo")
    expect(copy.body).toContain("1,000")
    expect(copy.content).toBe(`${copy.title}\n\n${copy.body}`)
  })
})

import { describe, expect, it } from "vitest"
import {
  GEMX_NOTIFICATIONS_SYSTEM_USER_ID,
  getMonthlyBonusNotifyCopy,
  MONTHLY_BONUS_NOTIFY_COPY,
} from "@/features/points/constants/monthly-bonus-notify"

describe("getMonthlyBonusNotifyCopy", () => {
  it("returns English title, body, and combined chat content with amount", () => {
    // Validates default locale copy matches product messaging for monthly bonus.
    const copy = getMonthlyBonusNotifyCopy(100)
    expect(copy.title).toBe("Your monthly bonus points have arrived! 🗓️")
    expect(copy.body).toBe(
      "Your monthly drop of 100 points is ready. Check your updated points balance now.",
    )
    expect(copy.content).toBe(`${copy.title}\n\n${copy.body}`)
  })

  it("supports my/th/ko locales for future language preference", () => {
    // Ensures localized helpers remain available even though runtime sends EN only.
    expect(getMonthlyBonusNotifyCopy(50, "my").body).toContain("50")
    expect(getMonthlyBonusNotifyCopy(50, "th").body).toContain("50")
    expect(getMonthlyBonusNotifyCopy(50, "ko").body).toContain("50")
    expect(Object.keys(MONTHLY_BONUS_NOTIFY_COPY)).toEqual(
      expect.arrayContaining(["en", "my", "th", "ko"]),
    )
  })

  it("exports the GemX system sender id used for chat inserts", () => {
    expect(GEMX_NOTIFICATIONS_SYSTEM_USER_ID).toBe("sys-gemx-notifications")
  })
})
